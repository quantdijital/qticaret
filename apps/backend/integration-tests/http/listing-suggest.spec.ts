import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { SEARCH_TERMS_MODULE } from "../../src/modules/search-terms"
import type SearchTermsModuleService from "../../src/modules/search-terms/service"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"
import { landingKit } from "../helpers/landings"
import { indexCatalogue } from "../helpers/search-index"
import type { LandingKit } from "../helpers/landings"

jest.setTimeout(180 * 1000)

interface Answer {
  product_ids: string[]
  count: number
  suggestions: string[]
  related: {
    categories: { id: string; name: string }[]
    brands: { id: string; name: string; handle: string }[]
  }
  message?: string
}

/**
 * The header's live search (`/store/listings/suggest`): the site search's
 * first few hits as the shopper types, with its count, suggestions and
 * related categories; never a term in the search report.
 */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    let kit: LandingKit
    let caki: string

    beforeEach(async () => {
      kit = await landingKit(http, getContainer())
      caki = await kit.product("katlanir-caki", { malzeme: "paslanmaz_celik" })
      await kit.post(`/admin/products/${caki}`, { title: "Katlanır Çakı" })
      // More hits than the panel shows: eight of a kind
      for (let at = 1; at <= 8; at++) {
        const id = await kit.product(`seramik-kase-${String(at)}`, { malzeme: "seramik" })
        await kit.post(`/admin/products/${id}`, { title: `Seramik Kase ${String(at)}` })
      }
    })

    const suggest = async (params: Record<string, string>) => {
      await indexCatalogue(getContainer())
      return settle(
        http.get<Answer>(
          `/store/listings/suggest?${new URLSearchParams({
            region_id: kit.shop.regionId,
            currency_code: "try",
            ...params,
          }).toString()}`,
          { headers: kit.store.headers }
        )
      )
    }

    it("answers the search's first six hits, its count and its related categories", async () => {
      const many = await suggest({ q: "seramik" })
      expect(many.status).toBe(200)
      expect(many.data.product_ids).toHaveLength(6)
      expect(many.data.count).toBeGreaterThanOrEqual(8)
      expect(many.data.related.categories[0]).toEqual({ id: kit.categoryId, name: "Ev ve Yaşam" })

      // A word being typed, and a typo, find it as the page would
      const typing = await suggest({ q: "katla" })
      expect(typing.data.product_ids[0]).toBe(caki)
      const typo = await suggest({ q: "katlnır" })
      expect(typo.data.product_ids[0]).toBe(caki)

      const near = await suggest({ q: "serammik" })
      expect(near.data.suggestions).toContain("seramik")

      const nothing = await suggest({ q: "zzqqxx" })
      expect(nothing.data).toEqual({
        product_ids: [],
        count: 0,
        suggestions: [],
        related: { categories: [], brands: [] },
      })
    })

    it("refuses words it cannot read and never counts them for the report", async () => {
      for (const params of [{ q: "" }, { q: "?!" }, { q: "a".repeat(101) }, {}]) {
        expect((await suggest(params)).status).toBe(400)
      }
      await suggest({ q: "kata" })
      await suggest({ q: "katlanır" })
      // Counting would run after the answer: give a stray one time to land
      await new Promise((resolve) => setTimeout(resolve, 300))
      const rows = await getContainer()
        .resolve<SearchTermsModuleService>(SEARCH_TERMS_MODULE)
        .listSearchTermDays({}, { select: ["term"] })
      expect(rows).toEqual([])
    })
  },
})
