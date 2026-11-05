import { randomUUID } from "node:crypto"
import { Modules } from "@medusajs/framework/utils"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { PLATFORM_SETTINGS_MODULE } from "../../src/modules/platform-settings"
import type PlatformSettingsModuleService from "../../src/modules/platform-settings/service"
import { placeOrder } from "../../src/scripts/seed/orders/place"
import { createAdminUser } from "../helpers/admin"
import { registerCustomer } from "../helpers/customer"
import type { TestCustomer } from "../helpers/customer"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"
import { PAYTR_ADDRESS } from "../helpers/paytr"
import { stockShop, stockedProduct } from "../helpers/stock"
import type { StockShop } from "../helpers/stock"
import { createStorefront } from "../helpers/storefront"
import type { Storefront } from "../helpers/storefront"
import { loadTrAddressFixture } from "../helpers/tr-address"

jest.setTimeout(180 * 1000)

interface StoreReviews {
  rating: { average: number; count: number } | null
  reviews: { id: string; rating: number; body: string; author_name: string }[]
}

/** F10.6 (adr/0037 §4; KK1, KK6): reviews from customers who received the product, after the shop. */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    let shop: StockShop
    let storefront: Storefront
    let admin: { headers: Record<string, string> }
    let customer: TestCustomer
    let productId: string
    let variantId: string
    let handle: string

    const review = (body: Record<string, unknown>, headers = customer.headers) =>
      settle(
        http.post<{ review?: { id: string }; message?: string }>(
          `/store/products/${productId}/reviews`,
          body,
          { headers }
        )
      )
    /** The queue as staff see it, and their decision on the reviews as seen there. */
    const queue = async () =>
      (
        await http.get<{ reviews: { id: string; updated_at: string; body: string }[] }>(
          "/admin/product-reviews?status=pending",
          { headers: admin.headers }
        )
      ).data.reviews
    const decide = (
      seen: { id: string; updated_at: string }[],
      status: "approved" | "rejected",
      reason?: string
    ) =>
      http.post<{ moderated: number; changed: string[] }>(
        "/admin/product-reviews/moderate",
        { reviews: seen, status, ...(reason ? { reason } : {}) },
        { headers: admin.headers }
      )
    const moderate = async (ids: string[], status: "approved" | "rejected", reason?: string) => {
      const seen = (await queue()).filter((each) => ids.includes(each.id))
      return decide(
        seen.map(({ id, updated_at }) => ({ id, updated_at })),
        status,
        reason
      )
    }
    const storeReviews = () =>
      http.get<StoreReviews>(`/store/products/${productId}/reviews`, {
        headers: storefront.headers,
      })
    const deliver = async (orderId: string) => {
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
    const orderFor = async (who: TestCustomer) => {
      const orderId = await placeOrder(getContainer(), {
        regionId: shop.regionId,
        salesChannelId: shop.salesChannelId,
        shippingOptionId: shop.shippingOptionId,
        items: [{ variant_id: variantId, quantity: 1 }],
        address: { ...PAYTR_ADDRESS, first_name: "Ayşe", last_name: "Yılmaz" },
        email: who.email,
      })
      await getContainer().resolve(Modules.ORDER).updateOrders(orderId, { customer_id: who.id })
      return orderId
    }

    beforeEach(async () => {
      const container = getContainer()
      await loadTrAddressFixture(container)
      shop = await stockShop(container)
      storefront = await createStorefront(container)
      admin = await createAdminUser(http, container)
      customer = await registerCustomer(http, storefront)
      await container
        .resolve(Modules.CUSTOMER)
        .updateCustomers(customer.id, { first_name: "Ayşe", last_name: "yılmaz" })
      handle = `bicak-${String(Date.now())}`
      ;({ productId, variantId } = await stockedProduct(container, shop, handle, 10, 250))
    })

    it("takes a review only once the product was delivered, and shows it once the shop approves", async () => {
      const orderId = await orderFor(customer)
      const early = await review({ rating: 5, body: "Henüz gelmedi ama güzel görünüyor." })
      await deliver(orderId)
      const written = await review({ rating: 4, title: "Keskin", body: "Çok keskin, sapı rahat." })
      const beforeApproval = await storeReviews()
      const { data: queue } = await http.get<{ reviews: { id: string; author_name: string }[] }>(
        "/admin/product-reviews?status=pending",
        { headers: admin.headers }
      )
      await moderate([written.data.review?.id ?? ""], "approved")
      const afterApproval = await storeReviews()
      // The shop's reviews page lists it with its product (F18 D10)
      const shopWide = await http.get<{
        reviews: { id: string; product_id: string; product_title: string }[]
      }>("/store/reviews", { headers: storefront.headers })
      // …and the shop's reviews in short (adr/0046 Ek 2026-11-05)
      const summary = await http.get<{ rating: unknown }>("/store/reviews/summary", {
        headers: storefront.headers,
      })
      const unknownParam = await settle(
        http.get("/store/reviews/summary?limit=5", { headers: storefront.headers })
      )
      // Structured data needs absolute URLs: the shop's domain
      await getContainer()
        .resolve<PlatformSettingsModuleService>(PLATFORM_SETTINGS_MODULE)
        .saveSection("seo", { canonical_host: "magaza.example.com" }, null)
      const page = await http.get<{ seo?: { jsonLd: Record<string, unknown>[] } }>(
        `/store/seo/resolve?path=${encodeURIComponent(`/urun/${handle}`)}`,
        { headers: storefront.headers }
      )
      const product = page.data.seo?.jsonLd.find((block) => block["@type"] === "Product")

      expect(early.data.message).toBe("reviews.not_purchased")
      expect(written.status).toBe(201)
      expect(beforeApproval.data).toMatchObject({ rating: null, reviews: [] })
      expect(queue.reviews.map((each) => each.id)).toContain(written.data.review?.id)
      // How many gave each number of stars (adr/0046 Ek 2026-11-04)
      expect(afterApproval.data.rating).toEqual({
        average: 4,
        count: 1,
        distribution: { "5": 0, "4": 1, "3": 0, "2": 0, "1": 0 },
      })
      expect(afterApproval.data.reviews[0]).toMatchObject({
        rating: 4,
        body: "Çok keskin, sapı rahat.",
        author_name: "Ayşe Y.",
      })
      expect(product?.["aggregateRating"]).toMatchObject({ ratingValue: "4.0", reviewCount: 1 })
      expect(summary.data.rating).toEqual({
        average: 4,
        count: 1,
        distribution: { "5": 0, "4": 1, "3": 0, "2": 0, "1": 0 },
      })
      expect(unknownParam.status).toBe(400)
      expect(
        shopWide.data.reviews.find((each) => each.id === written.data.review?.id)
      ).toMatchObject({
        product_id: productId,
      })
    })

    it("hides a changed review until it is approved again, and a rejected one for good", async () => {
      await deliver(await orderFor(customer))
      const first = await review({ rating: 5, body: "Harika bir ürün, tavsiye ederim." })
      const id = first.data.review?.id ?? ""
      await moderate([id], "approved")
      const changed = await review({
        rating: 2,
        body: "Bir ay sonra sapı gevşedi, bakın: https://kotu.example",
      })
      const whileWaiting = await storeReviews()
      const { data: queue } = await http.get<{ reviews: { id: string; has_link: boolean }[] }>(
        "/admin/product-reviews?status=pending",
        { headers: admin.headers }
      )
      await moderate([id], "rejected", "Bağlantı içeriyor")
      const afterRejection = await storeReviews()

      expect(changed.data.review?.id).toBe(id)
      expect(whileWaiting.data).toMatchObject({ rating: null, reviews: [] })
      expect(queue.reviews.find((each) => each.id === id)?.has_link).toBe(true)
      expect(afterRejection.data).toMatchObject({ rating: null, reviews: [] })
    })

    it("approves a review only as staff saw it: text changed since stays waiting", async () => {
      await deliver(await orderFor(customer))
      const first = await review({ rating: 5, body: "Harika bir ürün, tavsiye ederim." })
      const id = first.data.review?.id ?? ""
      const [seen] = await queue()
      // The author changes it while staff are reading the old text
      await review({ rating: 5, body: "Harika, şuradan daha ucuz: https://baska.example" })
      const approval = await decide(
        seen ? [{ id: seen.id, updated_at: seen.updated_at }] : [],
        "approved"
      )
      const shown = await storeReviews()

      expect(seen?.id).toBe(id)
      expect(approval.data).toMatchObject({ moderated: 0, changed: [id] })
      expect(shown.data).toMatchObject({ rating: null, reviews: [] })
    })

    it("lets no one write without a confirmed sign-in, and checks what is written", async () => {
      await deliver(await orderFor(customer))
      const registration = await http.post<{ token: string }>("/auth/customer/emailpass/register", {
        email: `onaysiz-${randomUUID()}@example.com`,
        password: randomUUID(),
      })
      const unconfirmed = await review(
        { rating: 5, body: "Doğrulanmamış hesaptan yorum." },
        { ...storefront.headers, authorization: `Bearer ${registration.data.token}` }
      )
      const anonymous = await review(
        { rating: 5, body: "Oturumsuz yorum denemesi." },
        storefront.headers
      )
      const outOfRange = await review({ rating: 6, body: "Altı yıldız olmaz ki." })
      const tooShort = await review({ rating: 3, body: "Kısa" })

      expect(unconfirmed.status).toBe(401)
      expect(anonymous.status).toBe(401)
      expect(outOfRange.status).toBe(400)
      expect(tooShort.status).toBe(400)
    })
  },
})
