import {
  createApiKeysWorkflow,
  createSalesChannelsWorkflow,
  linkProductsToSalesChannelWorkflow,
  linkSalesChannelsToApiKeyWorkflow,
} from "@medusajs/medusa/core-flows"
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

    const category = async (name: string, parent: string, isActive = true, isInternal = false) =>
      (
        await kit.post<{ product_category: { id: string } }>("/admin/product-categories", {
          name,
          parent_category_id: parent,
          is_active: isActive,
          is_internal: isInternal,
        })
      ).data.product_category.id

    const counted = async (headers: Record<string, string>) =>
      await settle(http.get<Counts>("/store/category-counts", { headers }))

    /**
     * A new sales channel with its own publishable key, these products in it
     * alone. Its answer is never one kept from an earlier test: the counts
     * are kept a minute per set of channels, and the default channel's id
     * outlives a test's data.
     */
    const ownChannel = async (name: string, products: string[]) => {
      const container = getContainer()
      const { result: channels } = await createSalesChannelsWorkflow(container).run({
        input: { salesChannelsData: [{ name }] },
      })
      const channel = channels[0]
      const { result: keys } = await createApiKeysWorkflow(container).run({
        input: { api_keys: [{ title: name, type: "publishable", created_by: "" }] },
      })
      const key = keys[0]
      if (!channel || !key) {
        throw new Error("no sales channel or key")
      }
      await linkSalesChannelsToApiKeyWorkflow(container).run({
        input: { id: key.id, add: [channel.id] },
      })
      await linkProductsToSalesChannelWorkflow(container).run({
        input: { id: channel.id, add: products },
      })
      await linkProductsToSalesChannelWorkflow(container).run({
        input: { id: kit.store.salesChannelId, remove: products },
      })
      return { "x-publishable-api-key": key.token }
    }

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
      // The kit's own products and the two in the shown subcategory, as its listing counts; not the hidden one's
      expect(counts[cups]).toBe(2)
      expect(counts[archive]).toBeUndefined()
      expect(counts[kit.categoryId]).toBe(await listed(kit.categoryId))
      expect(counts[cups]).toBe(await listed(cups))
    })

    it("counts each publishable key's own channels, kept apart, and says it varies by key", async () => {
      const cups = await category("Fincanlar", kit.categoryId)
      const ours = [
        await kit.product("bizim-fincan-1", { malzeme: "porselen" }, cups),
        await kit.product("bizim-fincan-2", { malzeme: "porselen" }, cups),
      ]
      const theirs = await kit.product("pazar-fincan", { malzeme: "porselen" }, cups)
      const first = await ownChannel("Mağaza", ours)
      const second = await ownChannel("Pazar yeri", [theirs])
      await indexCatalogue(getContainer())

      const one = await counted(first)
      const other = await counted(second)

      expect(one.status).toBe(200)
      expect(other.status).toBe(200)
      // Only the first key's channel's two products; not the second channel's one, nor the kit's cups
      expect(one.data.counts[cups]).toBe(2)
      expect(one.data.counts[kit.categoryId]).toBe(2)
      expect(other.data.counts[cups]).toBe(1)
      expect(other.data.counts[kit.categoryId]).toBe(1)
      // Asked again right after the other key, each keeps its own answer
      expect((await counted(first)).data.counts[cups]).toBe(2)
      expect(String(one.headers["vary"]).toLowerCase()).toContain("x-publishable-api-key")
      expect(String(one.headers["cache-control"])).toContain("stale-while-revalidate=60")
    })

    it("gives an internal category no count", async () => {
      const cups = await category("Fincanlar", kit.categoryId)
      const internal = await category("İç", kit.categoryId, true, true)
      const shown = await kit.product("gorunen-fincan", { malzeme: "seramik" }, cups)
      const hidden = await kit.product("ic-fincan", { malzeme: "seramik" }, internal)
      const headers = await ownChannel("İç kanal", [shown, hidden])
      await indexCatalogue(getContainer())

      const answer = await counted(headers)

      expect(answer.status).toBe(200)
      expect(answer.data.counts[cups]).toBe(1)
      expect(Object.keys(answer.data.counts)).not.toContain(internal)
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
