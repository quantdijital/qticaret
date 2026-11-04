import { existsSync } from "node:fs"
import { basename } from "node:path"
import { Modules } from "@medusajs/framework/utils"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import sharp from "sharp"
import { placeOrder } from "../../src/scripts/seed/orders/place"
import { removeReviewPhotos } from "../../src/workflows/customers/review-photos"
import { createAdminUser } from "../helpers/admin"
import { registerCustomer } from "../helpers/customer"
import type { TestCustomer } from "../helpers/customer"
import { filesNamed } from "../helpers/files"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"
import { PAYTR_ADDRESS } from "../helpers/paytr"
import { stockShop, stockedProduct } from "../helpers/stock"
import type { StockShop } from "../helpers/stock"
import { createStorefront } from "../helpers/storefront"
import type { Storefront } from "../helpers/storefront"
import { loadTrAddressFixture } from "../helpers/tr-address"

jest.setTimeout(180 * 1000)

interface Photo {
  id: string
  url: string
  width: number
  height: number
}

const stored = (url: string) => existsSync(filesNamed(new RegExp(`^${basename(url)}$`))[0] ?? "")

/** adr/0037 §4 Ek 2026-11-04: photos on a review, moderated with it, gone with the customer. */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    let shop: StockShop
    let storefront: Storefront
    let admin: { headers: Record<string, string> }
    let customer: TestCustomer
    let productId: string
    let variantId: string

    const upload = (bytes: Buffer, who = customer.headers) =>
      settle(
        http.post<{ photo?: { id: string }; message?: string }>(
          `/store/products/${productId}/reviews/photos`,
          bytes,
          { headers: { ...who, "content-type": "image/jpeg" } }
        )
      )
    const jpeg = (width: number, height: number) =>
      sharp({ create: { width, height, channels: 3, background: { r: 200, g: 120, b: 40 } } })
        .withMetadata({ exif: { IFD0: { Copyright: "kisi" } } })
        .jpeg()
        .toBuffer()
    const pending = async () =>
      (
        await http.get<{ reviews: { id: string; updated_at: string; photos: Photo[] }[] }>(
          "/admin/product-reviews?status=pending",
          { headers: admin.headers }
        )
      ).data.reviews
    const deliverOrder = async () => {
      const orderId = await placeOrder(getContainer(), {
        regionId: shop.regionId,
        salesChannelId: shop.salesChannelId,
        shippingOptionId: shop.shippingOptionId,
        items: [{ variant_id: variantId, quantity: 1 }],
        address: { ...PAYTR_ADDRESS, first_name: "Ayşe", last_name: "Yılmaz" },
        email: customer.email,
      })
      await getContainer()
        .resolve(Modules.ORDER)
        .updateOrders(orderId, { customer_id: customer.id })
      const shipped = await http.post<{ fulfillment_id: string }>(
        `/admin/orders/${orderId}/ship`,
        { notify: false },
        { headers: admin.headers }
      )
      await http.post(
        `/admin/orders/${orderId}/fulfillments/${shipped.data.fulfillment_id}/mark-as-delivered`,
        {},
        { headers: admin.headers }
      )
    }

    beforeEach(async () => {
      const container = getContainer()
      await loadTrAddressFixture(container)
      shop = await stockShop(container)
      storefront = await createStorefront(container)
      admin = await createAdminUser(http, container)
      customer = await registerCustomer(http, storefront)
      ;({ productId, variantId } = await stockedProduct(
        container,
        shop,
        `foto-${String(Date.now())}`,
        10,
        250
      ))
    })

    it("takes photos only from a buyer, shows them once the review is approved, never before", async () => {
      const beforeDelivery = await upload(await jpeg(40, 30))
      await deliverOrder()
      const notAnImage = await upload(Buffer.from("<svg onload=alert(1)>"))
      const first = await upload(await jpeg(80, 60))
      const second = await upload(await jpeg(30, 90))
      const ids = [second.data.photo?.id ?? "", first.data.photo?.id ?? ""]
      const tooMany = await settle(
        http.post<{ message?: string }>(
          `/store/products/${productId}/reviews`,
          {
            rating: 5,
            body: "Fotoğraflarıyla birlikte, çok iyi.",
            photo_ids: [...ids, "rvph_x", "rvph_y"],
          },
          { headers: customer.headers }
        )
      )
      const written = await http.post<{ review: { id: string } }>(
        `/store/products/${productId}/reviews`,
        { rating: 5, body: "Fotoğraflarıyla birlikte, çok iyi.", photo_ids: ids },
        { headers: customer.headers }
      )
      const reviewId = written.data.review.id
      const hidden = await http.get<{ reviews: unknown[] }>(
        `/store/products/${productId}/reviews`,
        { headers: storefront.headers }
      )
      const [seen] = (await pending()).filter((each) => each.id === reviewId)
      await http.post(
        "/admin/product-reviews/moderate",
        { reviews: seen ? [{ id: seen.id, updated_at: seen.updated_at }] : [], status: "approved" },
        { headers: admin.headers }
      )
      const shown = await http.get<{ reviews: { id: string; photos: Photo[] }[] }>(
        `/store/products/${productId}/reviews`,
        { headers: storefront.headers }
      )
      const shopWide = await http.get<{ reviews: { id: string; photos: Photo[] }[] }>(
        "/store/reviews",
        { headers: storefront.headers }
      )
      const home = await http.get<{
        photos: (Photo & { review_id: string; rating: number; product: { id: string } })[]
      }>("/store/reviews/photos?limit=1", { headers: storefront.headers })
      const urls = (seen?.photos ?? []).map((photo) => photo.url)

      expect(beforeDelivery.status).toBe(400)
      expect(beforeDelivery.data.message).toBe("reviews.not_purchased")
      expect(notAnImage.status).toBe(400)
      expect(first.status).toBe(201)
      expect(tooMany.status).toBe(400)
      expect(hidden.data.reviews).toEqual([])
      // Staff see them with the text, in the author's order
      expect(seen?.photos.map((photo) => photo.id)).toEqual(ids)
      expect(seen?.photos.map(({ width, height }) => [width, height])).toEqual([
        [30, 90],
        [80, 60],
      ])
      expect(shown.data.reviews[0]?.photos.map((photo) => photo.id)).toEqual(ids)
      expect(shopWide.data.reviews.find((each) => each.id === reviewId)?.photos).toHaveLength(2)
      expect(home.data.photos).toHaveLength(1)
      expect(home.data.photos[0]).toMatchObject({ review_id: reviewId, rating: 5 })
      expect(home.data.photos[0]?.product.id).toBe(productId)
      // Stored cleaned: no EXIF left (docs/04, F3.3)
      for (const url of urls) {
        expect(stored(url)).toBe(true)
      }
      const [file] = filesNamed(new RegExp(`^${basename(urls[0] ?? "-")}$`))
      const metadata = await sharp(file).metadata()
      expect(metadata.exif).toBeUndefined()
    })

    it("drops photos the review leaves out, sweeps unclaimed ones and erases a customer's", async () => {
      await deliverOrder()
      const kept = await upload(await jpeg(50, 50))
      const dropped = await upload(await jpeg(60, 60))
      const unclaimed = await upload(await jpeg(70, 70))
      const write = (photoIds: string[]) =>
        http.post<{ review: { id: string } }>(
          `/store/products/${productId}/reviews`,
          { rating: 4, body: "İlk hâliyle iki fotoğraf vardı.", photo_ids: photoIds },
          { headers: customer.headers }
        )
      await write([kept.data.photo?.id ?? "", dropped.data.photo?.id ?? ""])
      const before = (await pending())[0]?.photos ?? []
      await write([kept.data.photo?.id ?? ""])
      const after = (await pending())[0]?.photos ?? []
      const droppedUrl = before.find((photo) => photo.id === dropped.data.photo?.id)?.url ?? ""
      const swept = await removeReviewPhotos(getContainer(), {
        abandoned_before: new Date(Date.now() + 60_000),
      })
      const erased = await removeReviewPhotos(getContainer(), { customer_id: customer.id })
      const afterErasure = (await pending())[0]?.photos ?? []

      expect(unclaimed.status).toBe(201)
      expect(after.map((photo) => photo.id)).toEqual([kept.data.photo?.id])
      expect(stored(droppedUrl)).toBe(false)
      // The unclaimed upload went with the sweep; the review's own stayed
      expect(swept).toBe(1)
      expect(erased).toBe(1)
      expect(afterErasure).toEqual([])
    })
  },
})
