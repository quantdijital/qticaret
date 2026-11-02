import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { SEARCH_TERMS_MODULE } from "../../src/modules/search-terms"
import type SearchTermsModuleService from "../../src/modules/search-terms/service"
import { eventually } from "../helpers/eventually"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"
import { landingKit } from "../helpers/landings"
import type { LandingKit } from "../helpers/landings"

jest.setTimeout(180 * 1000)

interface FacetValue {
  value: string
  count: number
}

interface Answer {
  product_ids: string[]
  count: number
  facets: { attributes: { key: string; values: FacetValue[] }[] }
  search?: {
    suggestions: string[]
    related: {
      categories: { id: string; name: string }[]
      brands: { id: string; name: string }[]
    }
    took_ms: number
  }
  message?: string
}

/**
 * Site search as a listing (docs/20, adr/0046 ek 2026-11-03): typo
 * tolerant over the whole catalogue's rows, the listing's filters and
 * sorts, suggestions for a near miss, and the search report's count.
 */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    let kit: LandingKit
    let knives: { caki: string; ekmek: string; sef: string }

    // A published product in Ev ve Yaşam with this title, material and price
    const knife = async (handle: string, title: string, malzeme: string, amount: number) => {
      const id = await kit.product(handle, { malzeme })
      const product = await kit.post<{ product: { variants: { id: string }[] } }>(
        `/admin/products/${id}`,
        { title }
      )
      const variant = product.data.product.variants[0]?.id ?? ""
      await kit.post(`/admin/products/${id}/variants/${variant}`, {
        prices: [{ currency_code: "try", amount }],
      })
      return id
    }

    beforeEach(async () => {
      kit = await landingKit(http, getContainer())
      // Made before the first search: the catalogue's rows are kept 30 seconds
      knives = {
        caki: await knife("katlanir-caki", "Katlanır Çakı", "paslanmaz_celik", 450),
        ekmek: await knife("ekmek-bicak-seti", "Ekmek Bıçak Seti", "seramik", 300),
        sef: await knife("sef-bicagi", "Şef Bıçağı", "paslanmaz_celik", 900),
      }
    })

    const search = (params: Record<string, string>, query: Record<string, string> = {}) =>
      settle(
        http.get<Answer>(
          `/store/listings/products?${new URLSearchParams({
            type: "search",
            region_id: kit.shop.regionId,
            currency_code: "try",
            query: new URLSearchParams(query).toString(),
            ...params,
          }).toString()}`,
          { headers: kit.store.headers }
        )
      )

    it("finds a product through a typo or missing marks, the most relevant first", async () => {
      const typo = await search({ q: "katlnır" })
      expect(typo.status).toBe(200)
      expect(typo.data.product_ids[0]).toBe(knives.caki)

      const plain = await search({ q: "cakı" })
      expect(plain.data.product_ids[0]).toBe(knives.caki)

      // `Bıçak` in a title is exact, `Bıçağı` only alike; the demo grinder's
      // description (`seramik bıçaklı`) weighs least
      const relevant = await search({ q: "BICAK" })
      expect(relevant.data.product_ids.slice(0, 2)).toEqual([knives.ekmek, knives.sef])
      expect(relevant.data.count).toBe(relevant.data.product_ids.length)
      expect(relevant.data.search?.suggestions).toEqual([])
      expect(relevant.data.search?.related.categories[0]).toEqual({
        id: kit.categoryId,
        name: "Ev ve Yaşam",
      })
      expect(typeof relevant.data.search?.took_ms).toBe("number")

      const dearest = await search({ q: "bıçak" }, { sirala: "fiyat-azalan" })
      const knivesOnly = dearest.data.product_ids.filter(
        (id) => id === knives.sef || id === knives.ekmek
      )
      expect(knivesOnly).toEqual([knives.sef, knives.ekmek])
    })

    it("applies the listing's filters to what it found and counts its facets", async () => {
      const steel = await search({ q: "bıçak" }, { malzeme: "paslanmaz_celik" })
      expect(steel.status).toBe(200)
      expect(steel.data.product_ids).toEqual([knives.sef])
      const material = steel.data.facets.attributes.find((each) => each.key === "malzeme")
      // Counted among the search's hits, without the material filter itself
      expect(
        Object.fromEntries((material?.values ?? []).map((value) => [value.value, value.count]))
      ).toEqual({ paslanmaz_celik: 1, seramik: 1 })
    })

    it("suggests the catalogue's word for a near miss", async () => {
      const near = await search({ q: "bıçal" })
      expect(near.status).toBe(200)
      expect(near.data.search?.suggestions[0]).toBe("bıçak")
      expect(near.data.product_ids).toContain(knives.ekmek)

      const nothing = await search({ q: "zzqqxx" })
      expect([nothing.data.count, nothing.data.search?.suggestions]).toEqual([0, []])
    })

    it("refuses a search with no words, or too long", async () => {
      for (const params of [{ q: "" }, { q: "   " }, { q: "?!" }, { q: "a".repeat(101) }, {}]) {
        const refused = await search(params)
        expect(refused.status).toBe(400)
      }
      // Another listing still needs its id
      const listing = await search({ type: "all" })
      expect(listing.status).toBe(400)
    })

    it("counts a new search for the report, not its next page or a narrowed one", async () => {
      const stored = () =>
        getContainer()
          .resolve<SearchTermsModuleService>(SEARCH_TERMS_MODULE)
          .listSearchTermDays({}, { select: ["term", "searches", "zero_results"] })

      await search({ q: "Katlanır" })
      await search({ q: "seramik" }, { malzeme: "seramik" })
      await search({ q: "kupa" }, { sayfa: "2" })
      await search({ q: "yokyokyok" })

      await eventually(stored, (rows) => rows.length >= 2)
      // Counting runs after the answer: give a stray one time to land
      await new Promise((resolve) => setTimeout(resolve, 300))
      const rows = (await stored()).map(({ term, searches, zero_results }) => ({
        term,
        searches,
        zero_results,
      }))
      expect(rows).toHaveLength(2)
      expect(rows).toEqual(
        expect.arrayContaining([
          { term: "katlanır", searches: 1, zero_results: 0 },
          { term: "yokyokyok", searches: 1, zero_results: 1 },
        ])
      )
    })
  },
})
