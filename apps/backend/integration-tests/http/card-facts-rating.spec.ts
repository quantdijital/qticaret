import { Modules } from "@medusajs/framework/utils"
import { createProductsWorkflow } from "@medusajs/medusa/core-flows"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { PRODUCT_REVIEWS_MODULE } from "../../src/modules/product-reviews"
import type ProductReviewsModuleService from "../../src/modules/product-reviews/service"
import type { MigratedReview } from "../../src/modules/product-reviews/types"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"
import { stockShop, stockedProduct } from "../helpers/stock"
import { createStorefront } from "../helpers/storefront"

jest.setTimeout(180 * 1000)

interface Facts {
  facts: Record<string, { stock: string; rating: { average: number; count: number } | null }>
}

interface ProductReviews {
  rating: { average: number; count: number } | null
}

let serial = 0

/** A review as the shop's old platform showed it: approved here when published, else waiting. */
const review = (productId: string, rating: number, published: boolean): MigratedReview => {
  serial += 1
  return {
    source_ref: `card-facts-rating:${String(Date.now())}:${String(serial)}`,
    product_id: productId,
    customer_id: null,
    rating,
    title: null,
    body: "Elime ulaştı, anlatıldığı gibi.",
    author_name: "A. Y.",
    has_link: false,
    published,
    created_at: new Date("2026-11-01T09:00:00Z"),
  }
}

/** adr/0062: a card's stars are the product page's, approved reviews only, a page at a time. */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient

    it("answers the average and count of approved reviews, null without one", async () => {
      const container = getContainer()
      const shop = await stockShop(container)
      const store = await createStorefront(container)
      const stamp = String(Date.now())
      const [market] = await container
        .resolve(Modules.SALES_CHANNEL)
        .createSalesChannels([{ name: "Pazaryeri" }])
      const bare = await stockedProduct(container, shop, `yorumsuz-${stamp}`, 5)
      const waiting = await stockedProduct(container, shop, `bekleyen-${stamp}`, 5)
      const rated = await stockedProduct(container, shop, `puanli-${stamp}`, 5)
      const { result } = await createProductsWorkflow(container).run({
        input: {
          products: [
            {
              title: "Pazaryeri ürünü",
              handle: `pazaryeri-${stamp}`,
              status: "published",
              shipping_profile_id: shop.shippingProfileId,
              options: [{ title: "Seçenek", values: ["Standart"] }],
              variants: [
                {
                  title: "Standart",
                  options: { Seçenek: "Standart" },
                  manage_inventory: false,
                  prices: [],
                },
              ],
              sales_channels: [{ id: market?.id ?? "" }],
            },
          ],
        },
      })
      const elsewhere = result[0]?.id ?? ""
      await container
        .resolve<ProductReviewsModuleService>(PRODUCT_REVIEWS_MODULE)
        .addMigratedReviews([
          review(waiting.productId, 5, false),
          review(waiting.productId, 4, false),
          review(rated.productId, 5, true),
          review(rated.productId, 4, true),
          review(rated.productId, 4, true),
          // Waiting for the shop: in neither the average nor the count
          review(rated.productId, 1, false),
          review(elsewhere, 5, true),
        ])
      const ids = [bare.productId, waiting.productId, rated.productId, elsewhere]

      const answer = await settle(
        http.get<Facts>(`/store/card-facts?${ids.map((id) => `id=${id}`).join("&")}`, {
          headers: store.headers,
        })
      )
      const page = await settle(
        http.get<ProductReviews>(`/store/products/${rated.productId}/reviews`, {
          headers: store.headers,
        })
      )

      expect(answer.status).toBe(200)
      expect(answer.headers["cache-control"]).toBe("no-store")
      expect(answer.data.facts[bare.productId]).toMatchObject({ stock: "in_stock", rating: null })
      expect(answer.data.facts[waiting.productId]?.rating).toBeNull()
      // 13 stars over 3 reviews, to one decimal
      expect(answer.data.facts[rated.productId]?.rating).toEqual({ average: 4.3, count: 3 })
      // The product page's own numbers
      expect(page.data.rating).toMatchObject({ average: 4.3, count: 3 })
      // Reviewed, but not sold in the shopper's sales channel: no card, no stars
      expect(answer.data.facts).not.toHaveProperty(elsewhere)
      expect(Object.keys(answer.data.facts).sort()).toEqual(
        [bare.productId, waiting.productId, rated.productId].sort()
      )
    })
  },
})
