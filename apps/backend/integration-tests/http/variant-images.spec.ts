import { createProductsWorkflow } from "@medusajs/medusa/core-flows"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { createAdminUser } from "../helpers/admin"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"
import { stockShop } from "../helpers/stock"
import type { StockShop } from "../helpers/stock"
import { createStorefront } from "../helpers/storefront"
import type { Storefront } from "../helpers/storefront"

jest.setTimeout(120 * 1000)

interface StoreProduct {
  images: { url: string; variants?: { id: string }[] | null }[]
  variants: { id: string; title: string }[]
}

/**
 * Owner 2026-11-05 ("choosing another colour does not show its photo"):
 * a picture tied to a variant in the panel (Medusa's variant images) is
 * named with its variants' ids on the Store API, so the storefront brings
 * the chosen variant's pictures to the front.
 */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    let shop: StockShop
    let storefront: Storefront
    let admin: { headers: Record<string, string> }

    beforeEach(async () => {
      shop = await stockShop(getContainer())
      storefront = await createStorefront(getContainer())
      admin = await createAdminUser(http, getContainer())
    })

    it("names each picture's variants on the Store API once the panel tied them", async () => {
      const { result } = await createProductsWorkflow(getContainer()).run({
        input: {
          products: [
            {
              title: "Renkli Set",
              handle: "renkli-set",
              status: "published",
              shipping_profile_id: shop.shippingProfileId,
              images: [
                { url: "https://cdn.example.com/set.webp" },
                { url: "https://cdn.example.com/kirmizi.webp" },
              ],
              options: [{ title: "Renk", values: ["Kırmızı", "Mavi"] }],
              variants: ["Kırmızı", "Mavi"].map((renk) => ({
                title: renk,
                options: { Renk: renk },
                manage_inventory: false,
                prices: [{ currency_code: "try", amount: 1000 }],
              })),
              sales_channels: [{ id: shop.salesChannelId }],
            },
          ],
        },
      })
      const product = result[0]
      const red = product?.variants.find((variant) => variant.title === "Kırmızı")
      const picture = product?.images.find((image) => image.url.endsWith("/kirmizi.webp"))

      // As the panel ties it (variant-images-card.tsx)
      const tied = await settle(
        http.post(
          `/admin/products/${product?.id ?? ""}/images/${picture?.id ?? ""}/variants/batch`,
          { add: [red?.id] },
          { headers: admin.headers }
        )
      )
      expect(tied.status).toBe(200)

      const read = await settle(
        http.get<{ products: StoreProduct[] }>(
          `/store/products?handle=renkli-set&fields=${encodeURIComponent("images.url,images.variants.id,variants.title")}`,
          { headers: storefront.headers }
        )
      )
      expect(read.status).toBe(200)
      const images = read.data.products[0]?.images ?? []
      const variantsOf = (name: string) =>
        images.find((image) => image.url.endsWith(name))?.variants?.map((variant) => variant.id) ??
        []
      expect(variantsOf("/kirmizi.webp")).toEqual([red?.id])
      expect(variantsOf("/set.webp")).toEqual([])
    })
  },
})
