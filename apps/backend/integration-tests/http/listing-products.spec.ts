import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"
import { landingKit } from "../helpers/landings"
import { indexCatalogue } from "../helpers/search-index"
import type { LandingKit } from "../helpers/landings"

jest.setTimeout(180 * 1000)

interface FacetValue {
  value: string
  count: number
  selected: boolean
}

interface Answer {
  product_ids: string[]
  count: number
  page: number
  page_size: number
  facets: {
    brands: FacetValue[]
    attributes: { key: string; values: FacetValue[] }[]
    price: { min: number; max: number } | null
  }
  message?: string
}

/** F18 D4 (docs/13 §7): a listing's filtered, sorted page and the filters it offers. */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    let kit: LandingKit

    beforeEach(async () => {
      kit = await landingKit(http, getContainer())
    })

    const list = async (params: Record<string, string>) => {
      await indexCatalogue(getContainer())
      return settle(
        http.get<Answer>(
          `/store/listings/products?${new URLSearchParams({
            type: "product_category",
            id: kit.categoryId,
            region_id: kit.shop.regionId,
            currency_code: "try",
            query: new URLSearchParams(params).toString(),
          }).toString()}`,
          { headers: kit.store.headers }
        )
      )
    }

    const counts = (answer: Answer, key: string) =>
      Object.fromEntries(
        (answer.facets.attributes.find((each) => each.key === key)?.values ?? []).map((value) => [
          value.value,
          value.count,
        ])
      )

    it("narrows by an attribute, counts each filter without itself, and pages", async () => {
      const all = await list({})
      expect(all.status).toBe(200)
      const total = all.data.count
      expect(total).toBeGreaterThanOrEqual(4)
      expect(counts(all.data, "malzeme")).toMatchObject({ seramik: 3, porselen: 1 })
      expect(all.data.facets.price).not.toBeNull()

      const ceramic = await list({ malzeme: "seramik" })
      expect(ceramic.data.count).toBe(3)
      // Material counted without itself; colour counted among the ceramic cups
      expect(counts(ceramic.data, "malzeme")).toMatchObject({ seramik: 3, porselen: 1 })
      expect(counts(ceramic.data, "renk")).toEqual({ kirmizi: 2, mavi: 2 })

      const both = await list({ malzeme: "porselen,seramik", renk: "mavi" })
      expect(both.data.count).toBe(3)
      expect(both.data.product_ids).toHaveLength(3)
    })

    it("sorts by price and keeps to a price range", async () => {
      const cheap = await kit.product("kupa-ucuz", { malzeme: "seramik", renk: ["mavi"] })
      const dear = await kit.product("kupa-pahali", { malzeme: "seramik", renk: ["mavi"] })
      await kit.post(`/admin/products/${cheap}`, {})
      const prices = async (id: string, amount: number) => {
        const product = await kit.post<{ product: { variants: { id: string }[] } }>(
          `/admin/products/${id}`,
          {}
        )
        const variant = product.data.product.variants[0]?.id ?? ""
        await kit.post(`/admin/products/${id}/variants/${variant}`, {
          prices: [{ currency_code: "try", amount }],
        })
      }
      await prices(cheap, 10)
      await prices(dear, 9000)

      const up = await list({ sirala: "fiyat-artan" })
      expect(up.data.product_ids[0]).toBe(cheap)
      const down = await list({ sirala: "fiyat-azalan" })
      expect(down.data.product_ids[0]).toBe(dear)
      const range = await list({ fiyat: "5000-" })
      expect(range.data.product_ids).toEqual([dear])
    })

    it("answers 404 past the filters a listing takes, as its page does", async () => {
      // More values for one filter than a listing answers (a crawler's trap)
      const values = Array.from({ length: 11 }, (_, index) => `deger${String(index)}`)
      const refused = await list({ malzeme: values.join(",") })
      expect([refused.status, refused.data.message]).toEqual([404, "listing.out_of_bounds"])
    })
    it("lists the whole catalogue as `all`", async () => {
      await indexCatalogue(getContainer())
      const all = await settle(
        http.get<Answer>(
          `/store/listings/products?${new URLSearchParams({
            type: "all",
            id: "all",
            region_id: kit.shop.regionId,
            currency_code: "try",
            query: "malzeme=seramik",
          }).toString()}`,
          { headers: kit.store.headers }
        )
      )
      expect(all.status).toBe(200)
      expect(all.data.count).toBe(3)
    })
  },
})
