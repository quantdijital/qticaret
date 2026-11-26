import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { PLATFORM_SETTINGS_MODULE } from "../../src/modules/platform-settings"
import type PlatformSettingsModuleService from "../../src/modules/platform-settings/service"
import { createAdminUser } from "../helpers/admin"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"
import { indexCatalogue } from "../helpers/search-index"
import { stockShop, stockedProduct } from "../helpers/stock"
import type { StockShop } from "../helpers/stock"
import { createStorefront } from "../helpers/storefront"
import type { Storefront } from "../helpers/storefront"

jest.setTimeout(240 * 1000)

interface Linked {
  id: string
  title: string
  status: string
}

interface Catalog {
  upsells: Linked[]
  cross_sells: Linked[]
  message?: string
}

/**
 * S3: a product's linked products. The shop saves two ordered lists
 * through the catalog route (checked: twelve at most, each once, never the
 * product itself, every product there); the store answers them in order,
 * published products only, the given ones left out, sold-out ones too
 * while the shop hides them from its listings.
 */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    let admin: { headers: Record<string, string> }
    let store: Storefront
    let shop: StockShop
    let main: string
    let others: string[]

    const product = async (handle: string, quantity = 5) =>
      (await stockedProduct(getContainer(), shop, handle, quantity)).productId
    const save = (id: string, body: Record<string, unknown>) =>
      settle(http.post<Catalog>(`/admin/products/${id}/catalog`, body, { headers: admin.headers }))
    const linked = (kind: string, ids: string[]) => {
      const params = new URLSearchParams({ kind })
      for (const id of ids) {
        params.append("product_id", id)
      }
      return settle(
        http.get<{ product_ids: string[]; message?: string }>(
          `/store/linked-products?${params.toString()}`,
          { headers: store.headers }
        )
      )
    }

    beforeEach(async () => {
      admin = await createAdminUser(http, getContainer())
      store = await createStorefront(getContainer())
      shop = await stockShop(getContainer())
      main = await product("bagli-ana")
      others = [await product("bagli-bir"), await product("bagli-iki"), await product("bagli-uc")]
    })

    afterEach(async () => {
      // The settings cache outlives the database reset between tests
      await getContainer()
        .resolve<PlatformSettingsModuleService>(PLATFORM_SETTINGS_MODULE)
        .saveSection("inventory", { out_of_stock_listing: "show" }, null)
    })

    it("saves both lists in the shop's order, reads them back and clears them", async () => {
      const [a, b, c] = others as [string, string, string]
      const saved = await save(main, { upsell_product_ids: [c, a], cross_sell_product_ids: [b] })
      expect(saved.status).toBe(200)
      expect(saved.data.upsells.map((row) => row.id)).toEqual([c, a])
      expect(saved.data.cross_sells.map((row) => [row.id, row.status])).toEqual([[b, "published"]])
      // A save of other fields leaves the lists as they are
      const kept = await save(main, { condition: "new" })
      expect(kept.data.upsells.map((row) => row.id)).toEqual([c, a])

      const cleared = await save(main, { upsell_product_ids: [], cross_sell_product_ids: null })
      expect(cleared.status).toBe(200)
      expect([cleared.data.upsells, cleared.data.cross_sells]).toEqual([[], []])
    })

    it("refuses the product itself, a product not there, the same one twice and past twelve", async () => {
      const [a] = others as [string]
      const self = await save(main, { upsell_product_ids: [a, main] })
      expect([self.status, self.data.message]).toEqual([400, "catalog.linked_self"])
      const unknown = await save(main, { cross_sell_product_ids: ["prod_01YOKBOYLEBIRURUN"] })
      expect([unknown.status, unknown.data.message]).toEqual([400, "catalog.linked_unknown"])
      expect((await save(main, { upsell_product_ids: [a, a] })).status).toBe(400)
      const many = Array.from({ length: 13 }, (_, index) => `prod_${String(index)}`)
      expect((await save(main, { upsell_product_ids: many })).status).toBe(400)
    })

    it("answers published products only, in order; a deleted one is skipped", async () => {
      const [a, b, c] = others as [string, string, string]
      await save(main, { upsell_product_ids: [b, a, c] })
      const draft = await settle(
        http.post(`/admin/products/${a}`, { status: "draft" }, { headers: admin.headers })
      )
      expect(draft.status).toBe(200)
      const removed = await settle(http.delete(`/admin/products/${c}`, { headers: admin.headers }))
      expect(removed.status).toBe(200)

      const answer = await linked("upsell", [main])
      expect(answer.status).toBe(200)
      expect(answer.data.product_ids).toEqual([b])
      // The admin still lists the draft (marked), not the deleted one
      const read = await settle(
        http.get<Catalog>(`/admin/products/${main}/catalog`, { headers: admin.headers })
      )
      expect(read.data.upsells.map((row) => [row.id, row.status])).toEqual([
        [b, "published"],
        [a, "draft"],
      ])
    })

    it("merges a cart's cross-sells once each, leaving out what is in the cart", async () => {
      const [a, b, c] = others as [string, string, string]
      await save(main, { cross_sell_product_ids: [a, b] })
      await save(a, { cross_sell_product_ids: [c, main, b] })
      const answer = await linked("cross_sell", [main, a])
      expect(answer.status).toBe(200)
      expect(answer.data.product_ids).toEqual([b, c])
      expect((await linked("cross_sell", [main])).data.product_ids).toEqual([a, b])
      expect((await linked("bogus", [main])).status).toBe(400)
    })

    it("leaves sold-out products out while the shop hides them from listings", async () => {
      const soldOut = await product("bagli-tukendi", 0)
      const [a] = others as [string]
      await save(main, { cross_sell_product_ids: [soldOut, a] })
      await indexCatalogue(getContainer())
      expect((await linked("cross_sell", [main])).data.product_ids).toEqual([soldOut, a])

      const hidden = await settle(
        http.post(
          "/admin/platform-settings/inventory",
          { out_of_stock_listing: "hide" },
          { headers: admin.headers }
        )
      )
      expect(hidden.status).toBe(200)
      expect((await linked("cross_sell", [main])).data.product_ids).toEqual([a])
    })
  },
})
