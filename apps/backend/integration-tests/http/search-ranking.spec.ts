import { Modules } from "@medusajs/framework/utils"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { SEARCH_INDEX_MODULE } from "../../src/modules/search-index"
import type SearchIndexModuleService from "../../src/modules/search-index/service"
import type { HttpClient } from "../helpers/http"
import { among, searchKit } from "../helpers/search"
import type { SearchKit } from "../helpers/search"

jest.setTimeout(240 * 1000)

/**
 * Site search's matching and ranking in PostgreSQL full text (adr/0056):
 * the in-memory search's behaviour kept (marks, typos, weights, all but
 * one word, the whole query in a title, codes as written) and what the
 * index adds (Turkish stems, starts as one types, stock and popularity).
 */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    let kit: SearchKit

    beforeEach(async () => {
      kit = await searchKit(http, getContainer())
    })

    it("ranks the word over its Turkish forms, those over its start and a typo", async () => {
      const exact = await kit.product({ title: "Ekmek Bıçak Seti" })
      const inflected = await kit.product({ title: "Şef Bıçağı" })
      const started = await kit.product({ title: "Bıçakçı Önlüğü" })
      const other = await kit.product({ title: "Seramik Kupa" })
      const all = [exact, inflected, started, other]

      const answer = await kit.search("bıçak")
      expect(answer.status).toBe(200)
      expect(among(answer.data, all)).toEqual([exact, inflected, started])
      // Without marks, in capitals: the same
      expect(among((await kit.search("BICAK")).data, all)).toEqual([exact, inflected, started])
      // An inflected query finds the word by its stem
      expect(among((await kit.search("bıçakları")).data, all).slice(0, 2)).toEqual(
        expect.arrayContaining([exact, inflected])
      )
      // A typo, only when nothing better is found
      expect(among((await kit.search("bıçal")).data, all)).toContain(exact)
    })

    it("finds `çakı` for `cakı`, a word as it is typed, a suffix the stemmer misses", async () => {
      const caki = await kit.product({ title: "Katlanır Çakı" })
      const cup = await kit.product({ title: "Seramik Kupa" })
      expect(among((await kit.search("cakı")).data, [caki, cup])).toEqual([caki])
      expect(among((await kit.search("katla")).data, [caki, cup])).toEqual([caki])
      expect(among((await kit.search("katlnır")).data, [caki, cup])).toEqual([caki])
      expect(among((await kit.search("kupalar")).data, [caki, cup])).toEqual([cup])
    })

    it("weighs the title over categories, those over options and the description", async () => {
      const steel = await kit.category("Çelik Ürünler")
      const title = await kit.product({ title: "Çelik Kılıf" })
      const category = await kit.product({ title: "Kılıf", category_ids: [steel] })
      const option = await kit.product({
        title: "Kılıf",
        option: { title: "Malzeme", value: "Çelik" },
      })
      const text = await kit.product({
        title: "Kılıf",
        description: "<p>Bir <b>çelik</b> kılıf</p>",
      })
      const answer = await kit.search("çelik")
      expect(among(answer.data, [title, category, option, text])).toEqual([
        title,
        category,
        option,
        text,
      ])
      expect(answer.data.search?.related.categories).toContainEqual({
        id: steel,
        name: "Çelik Ürünler",
      })
    })

    it("needs every word of a short query, all but one of a longer one, the whole query lifted", async () => {
      const full = await kit.product({ title: "Kırmızı Katlanır Çakı" })
      const both = await kit.product({ title: "Kırmızı Çakı" })
      const one = await kit.product({ title: "Mavi Çakı" })
      const ids = [full, both, one]
      // The title that is the query first
      expect(among((await kit.search("kırmızı çakı")).data, ids)).toEqual([both, full])
      // Three words: two of them are enough, all three rank first
      expect(among((await kit.search("kırmızı katlanır çakı")).data, ids)).toEqual([full, both])

      const apart = await kit.product({ title: "Çelik Saplı Ekmek Bıçak" })
      const phrase = await kit.product({ title: "Ekmek Bıçak Çelik" })
      expect(among((await kit.search("bıçak çelik")).data, [apart, phrase])[0]).toBe(phrase)
    })

    it("reads a code as written, with or without its separators, never a neighbour of it", async () => {
      const coded = await kit.product({ title: "Kupa", sku: "KUPA-MAVI-01" })
      const a = await kit.product({ title: "Bıçak Model123" })
      const b = await kit.product({ title: "Bıçak Model124" })
      expect((await kit.search("KUPA-MAVI-01")).data.product_ids[0]).toBe(coded)
      expect((await kit.search("kupamavi01")).data.product_ids).toEqual([coded])
      expect(among((await kit.search("model123")).data, [a, b])).toEqual([a])
    })

    it("shows what is in stock first, the popular first among equals", async () => {
      const gone = await kit.product({ title: "Seramik Tabak", inStock: false })
      const quiet = await kit.product({ title: "Seramik Tabak" })
      const popular = await kit.product({ title: "Seramik Tabak" })
      const ids = [gone, quiet, popular]
      await kit.search("tabak")
      await getContainer()
        .resolve<SearchIndexModuleService>(SEARCH_INDEX_MODULE)
        .bumpPopularity([popular], 5)
      const answer = await kit.search("tabak", {}, { indexed: false })
      expect(among(answer.data, ids)).toEqual([popular, quiet, gone])
      expect(answer.data.facets.stock).toEqual({ count: 2, selected: false })

      const stocked = await kit.search("tabak", { stok: "var" }, { indexed: false })
      expect(among(stocked.data, ids)).toEqual([popular, quiet])
      expect(stocked.data.facets.stock.selected).toBe(true)
    })

    it("finds no draft and nothing of another sales channel", async () => {
      const [market] = await getContainer()
        .resolve(Modules.SALES_CHANNEL)
        .createSalesChannels([{ name: "Pazaryeri" }])
      const draft = await kit.product({ title: "Taslak Fincan", status: "draft" })
      const shown = await kit.product({ title: "Görünür Fincan" })
      const elsewhere = await kit.product({
        title: "Pazaryeri Fincan",
        sales_channel_id: market?.id ?? "",
      })
      const answer = await kit.search("fincan")
      expect(among(answer.data, [draft, shown, elsewhere])).toEqual([shown])
    })

    it("suggests the catalogue's words some product holds together", async () => {
      await kit.product({ title: "Şef Bıçağı" })
      await kit.product({ title: "Ekmek Bıçak Seti" })
      const answer = await kit.search("sef bical")
      expect(answer.data.search?.suggestions[0]).toBe("şef bıçağı")
      expect((await kit.search("ekmek")).data.search?.suggestions).toEqual([])
    })
  },
})
