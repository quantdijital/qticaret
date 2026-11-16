import { createPriceListsWorkflow } from "@medusajs/medusa/core-flows"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { advanceOrder } from "../../src/scripts/seed/orders/advance"
import { placeOrder } from "../../src/scripts/seed/orders/place"
import { createAdminUser } from "../helpers/admin"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"
import { indexCatalogue } from "../helpers/search-index"
import { stockShop, stockedProduct } from "../helpers/stock"
import type { StockShop } from "../helpers/stock"
import { createStorefront } from "../helpers/storefront"
import type { Storefront } from "../helpers/storefront"

jest.setTimeout(240 * 1000)

type Section = Record<string, unknown> & { id: string; type: string }

interface StoreLayout {
  layout: { home: Section[] }
}

const ALWAYS = { visible: true, starts_at: null, ends_at: null }

const rail = (id: string, source: Record<string, unknown>, limit: number): Section => ({
  id,
  type: "products",
  ...ALWAYS,
  title: null,
  source,
  limit,
  more: null,
})

/**
 * The home page's sale and best-seller rails (adr/0049 Ek 2026-11-05):
 * picked on the server for the publishable key's sales channels, named
 * by id in the layout read; the storefront loads them live.
 */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    let shop: StockShop
    let store: Storefront
    let asOwner: { headers: Record<string, string> }

    beforeEach(async () => {
      const container = getContainer()
      shop = await stockShop(container)
      store = await createStorefront(container)
      asOwner = { headers: (await createAdminUser(http, container)).headers }
    })

    const product = async (handle: string) => stockedProduct(getContainer(), shop, handle, 50, 100)

    const order = (variantId: string, quantity: number) =>
      placeOrder(getContainer(), {
        ...shop,
        items: [{ variant_id: variantId, quantity }],
        address: { first_name: "Ayşe", last_name: "Yılmaz", address_1: "Demo Sokak 1" },
      })

    /** The draft's home page as the storefront would show it (a preview is never held). */
    async function previewHome(home: Section[]): Promise<Section[]> {
      const saved = await settle(
        http.post(
          "/admin/storefront-layout",
          { document: { header: [], home, footer: [], product: [], category: [] } },
          asOwner
        )
      )
      expect(saved.status).toBe(200)
      const preview = await settle(
        http.post<{ path: string }>("/admin/storefront-layout/preview", {}, asOwner)
      )
      const token = preview.data.path.split("/").pop() ?? ""
      const shown = await settle(
        http.get<StoreLayout>(`/store/storefront-layout/preview/${token}`, {
          headers: store.headers,
        })
      )
      expect(shown.status).toBe(200)
      return shown.data.layout.home
    }

    it("lists what is on sale for every shopper, the deepest discount first", async () => {
      const full = await product("kupa-tam-fiyat")
      const deep = await product("kupa-yari-fiyat")
      const shallow = await product("kupa-az-indirim")
      await createPriceListsWorkflow(getContainer()).run({
        input: {
          price_lists_data: [
            {
              title: "Hafta sonu",
              description: "",
              status: "active",
              prices: [
                // The newest on sale has the smaller cut: depth decides, not age
                { variant_id: deep.variantId, amount: 50, currency_code: "try" },
                { variant_id: shallow.variantId, amount: 90, currency_code: "try" },
              ],
            },
          ],
        },
      })
      await indexCatalogue(getContainer())

      const [sale] = await previewHome([rail("indirimde01", { kind: "on_sale" }, 4)])
      expect(sale).toEqual({
        id: "indirimde01",
        type: "products",
        // Saved without them: today's grid (adr/0049 Ek 2026-11-15), the theme's card
        variant: "grid",
        card_variant: null,
        title: null,
        source: { kind: "on_sale" },
        limit: 4,
        // Saved without it: three in a row (adr/0049 Ek 2026-11-05, grid columns)
        columns: 3,
        more: null,
        product_ids: [deep.productId, shallow.productId],
        filled_with_newest: false,
      })
      expect(sale?.["product_ids"]).not.toContain(full.productId)
    })

    it("ranks paid units sold, leaves canceled orders and hidden products out, fills with the newest", async () => {
      const container = getContainer()
      const a = await product("bicak-a")
      const b = await product("bicak-b")
      const c = await product("bicak-c")
      const d = await product("bicak-d")
      const hidden = await product("bicak-gizli")
      await order(b.variantId, 3)
      await order(c.variantId, 1)
      await order(c.variantId, 1)
      // Ten units of D, canceled: no sale
      await advanceOrder(container, await order(d.variantId, 10), "canceled")
      // Sold well, then taken off the shop: not shown
      await order(hidden.variantId, 9)
      const unpublished = await settle(
        http.post(`/admin/products/${hidden.productId}`, { status: "draft" }, asOwner)
      )
      expect(unpublished.status).toBe(200)
      await indexCatalogue(container)

      const home = await previewHome([
        rail("coksatan01", { kind: "best_sellers" }, 2),
        rail("coksatan02", { kind: "best_sellers", days: 30 }, 4),
      ])
      expect(home[0]).toMatchObject({
        source: { kind: "best_sellers", days: 90 },
        product_ids: [b.productId, c.productId],
        filled_with_newest: false,
      })
      // Too few sales for four: the newest products not among them make up the rest
      expect(home[1]).toMatchObject({
        source: { kind: "best_sellers", days: 30 },
        product_ids: [b.productId, c.productId, d.productId, a.productId],
        filled_with_newest: true,
      })

      // The published design's read picks for the key's sales channels too
      const published = await settle(http.post("/admin/storefront-layout/publish", {}, asOwner))
      expect(published.status).toBe(200)
      const live = await settle(
        http.get<StoreLayout>("/store/storefront-layout", { headers: store.headers })
      )
      expect(live.data.layout.home.map((section) => section["product_ids"])).toEqual([
        [b.productId, c.productId],
        [b.productId, c.productId, d.productId, a.productId],
      ])
    })

    it("saves a strips rail with its count and look, picks that many, refuses an off-list count or step", async () => {
      const container = getContainer()
      await product("serit-a")
      const b = await product("serit-b")
      const c = await product("serit-c")
      // Above any sale an earlier case in this file left behind; its own window (14 days), as the
      // best sellers are held a few minutes per window
      await order(b.variantId, 30)
      await order(c.variantId, 20)
      await indexCatalogue(container)

      // adr/0049 Ek 2026-11-16: a strip per product, two to eight; the count is strips_count, not limit
      const strips = (more: Record<string, unknown> = {}): Section => ({
        id: "seritraf01",
        type: "products",
        ...ALWAYS,
        title: null,
        source: { kind: "best_sellers", days: 14 },
        more: null,
        variant: "strips",
        strips_count: 2,
        ...more,
      })
      const save = (section: Section) =>
        settle(
          http.post(
            "/admin/storefront-layout",
            { document: { header: [], home: [section], footer: [], product: [], category: [] } },
            asOwner
          )
        )
      for (const refused of [
        { strips_count: 1 },
        { strips_count: 9 },
        { strips_height: "tall" },
        { strips_slant: "dik" },
        { strips_overlap: true },
      ]) {
        expect((await save(strips(refused))).status).toBe(400)
      }

      const [rack] = await previewHome([strips({ strips_slant: "steep" })])
      expect(rack).toMatchObject({
        id: "seritraf01",
        variant: "strips",
        source: { kind: "best_sellers", days: 14 },
        strips_count: 2,
        // Saved without them: the rail's own default height (low) and the shared look's
        strips_height: "low",
        strips_slant: "steep",
        strips_line: "thin",
        strips_overlap: "off",
        strips_dim: "on",
        product_ids: [b.productId, c.productId],
      })
      expect(rack).not.toHaveProperty("columns")
    })
  },
})
