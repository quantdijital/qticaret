import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"
import { landingKit } from "../helpers/landings"
import type { LandingKit } from "../helpers/landings"
import { indexCatalogue } from "../helpers/search-index"

jest.setTimeout(180 * 1000)

interface Counts {
  counts: Record<string, number>
}

/**
 * adr/0049 Ek 2026-11-14 §10 karar 7b: every shown category's product
 * count in one answer, the shown subcategories' products included, by the
 * rule its listing counts.
 */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    let kit: LandingKit

    beforeEach(async () => {
      kit = await landingKit(http, getContainer())
    })

    const category = async (name: string, parent: string, isActive = true) =>
      (
        await kit.post<{ product_category: { id: string } }>("/admin/product-categories", {
          name,
          parent_category_id: parent,
          is_active: isActive,
        })
      ).data.product_category.id

    const listed = async (id: string) =>
      (
        await settle(
          http.get<{ count: number }>(
            `/store/listings/products?${new URLSearchParams({
              type: "product_category",
              id,
              region_id: kit.shop.regionId,
              currency_code: "try",
            }).toString()}`,
            { headers: kit.store.headers }
          )
        )
      ).data.count

    it("counts a category with its shown subcategories, published products only, as its listing does", async () => {
      const cups = await category("Fincanlar", kit.categoryId)
      const archive = await category("Arşiv", kit.categoryId, false)
      await kit.product("fincan-1", { malzeme: "porselen" }, cups)
      await kit.product("fincan-2", { malzeme: "porselen" }, cups)
      await kit.product("eski-fincan", { malzeme: "seramik" }, archive)
      const draft = await kit.product("taslak-fincan", { malzeme: "seramik" }, cups)
      await kit.post(`/admin/products/${draft}`, { status: "draft" })
      await indexCatalogue(getContainer())

      const answer = await settle(
        http.get<Counts>("/store/category-counts", { headers: kit.store.headers })
      )

      expect(answer.status).toBe(200)
      expect(answer.headers["cache-control"]).toContain("public")
      const { counts } = answer.data
      // The four cups of the kit and the two in the shown subcategory; not the hidden one's
      expect(counts[kit.categoryId]).toBe(6)
      expect(counts[cups]).toBe(2)
      expect(counts[archive]).toBeUndefined()
      expect(counts[kit.categoryId]).toBe(await listed(kit.categoryId))
      expect(counts[cups]).toBe(await listed(cups))
    })

    it("refuses a query it does not take", async () => {
      const refused = await settle(
        http.get<{ message?: string }>("/store/category-counts?id=pcat_1", {
          headers: kit.store.headers,
        })
      )
      expect(refused.status).toBe(400)
    })
  },
})
