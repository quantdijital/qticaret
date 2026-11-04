import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { createProductsWorkflow } from "@medusajs/medusa/core-flows"
import { createAdminUser } from "../helpers/admin"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"
import { stockShop, stockedProduct } from "../helpers/stock"
import { createStorefront } from "../helpers/storefront"

jest.setTimeout(180 * 1000)

interface Facts {
  facts: Record<
    string,
    { stock: "in_stock" | "low" | "out"; quick_add: { variant_id: string } | null }
  >
}

/** adr/0046 Ek 2026-11-04: a card's stock as a bucket and its quick-add variant, a page at a time. */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient

    it("answers a bucket, never the number, and quick add for a single variant to be had", async () => {
      const container = getContainer()
      const shop = await stockShop(container)
      const store = await createStorefront(container)
      const owner = await createAdminUser(http, container)
      const stamp = String(Date.now())
      const plenty = await stockedProduct(container, shop, `bol-${stamp}`, 10)
      const few = await stockedProduct(container, shop, `az-${stamp}`, 2)
      const none = await stockedProduct(container, shop, `yok-${stamp}`, 0)
      const { result } = await createProductsWorkflow(container).run({
        input: {
          products: [
            {
              title: "İki seçenekli",
              handle: `iki-${stamp}`,
              status: "published",
              shipping_profile_id: shop.shippingProfileId,
              options: [{ title: "Renk", values: ["Kırmızı", "Mavi"] }],
              variants: [
                {
                  title: "Kırmızı",
                  options: { Renk: "Kırmızı" },
                  manage_inventory: false,
                  prices: [],
                },
                { title: "Mavi", options: { Renk: "Mavi" }, manage_inventory: false, prices: [] },
              ],
              sales_channels: [{ id: shop.salesChannelId }],
            },
            {
              title: "Taslak",
              handle: `taslak-${stamp}`,
              status: "draft",
              shipping_profile_id: shop.shippingProfileId,
              options: [{ title: "Seçenek", values: ["Standart"] }],
              variants: [{ title: "Standart", options: { Seçenek: "Standart" }, prices: [] }],
              sales_channels: [{ id: shop.salesChannelId }],
            },
          ],
        },
      })
      const two = result[0]?.id ?? ""
      const draft = result[1]?.id ?? ""
      const ids = [plenty.productId, few.productId, none.productId, two, draft]
      const facts = () =>
        settle(
          http.get<Facts>(`/store/card-facts?${ids.map((id) => `id=${id}`).join("&")}`, {
            headers: store.headers,
          })
        )
      const threshold = (value: number) =>
        settle(
          http.post(
            "/admin/platform-settings/storefront",
            { low_stock_threshold: value },
            { headers: owner.headers }
          )
        )

      const first = await facts()
      await threshold(0)
      const neverLow = await facts()
      // Settings outlive the database reset between tests (their cache)
      await threshold(3)
      const refused = await settle(
        http.get("/store/card-facts?id=not-a-product", { headers: store.headers })
      )

      expect(first.status).toBe(200)
      expect(first.headers["cache-control"]).toBe("no-store")
      expect(first.data.facts).toEqual({
        [plenty.productId]: { stock: "in_stock", quick_add: { variant_id: plenty.variantId } },
        [few.productId]: { stock: "low", quick_add: { variant_id: few.variantId } },
        [none.productId]: { stock: "out", quick_add: null },
        // Two variants need the page to choose; a variant keeping no count is to be had
        [two]: { stock: "in_stock", quick_add: null },
      })
      // A draft is no card: left out
      expect(first.data.facts).not.toHaveProperty(draft)
      expect(JSON.stringify(first.data)).not.toMatch(/"(quantity|available|inventory)/)
      expect(neverLow.data.facts[few.productId]?.stock).toBe("in_stock")
      expect(refused.status).toBe(400)
    })
  },
})
