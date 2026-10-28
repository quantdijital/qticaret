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

interface Listed {
  questions: { id: string; body: string; answers: { body: string; by_shop: boolean }[] }[]
}

interface QuestionPage {
  path: string | null
  json_ld: Record<string, unknown> | null
  question: { answers: { by_shop: boolean }[] }
}

/** F10.10 (adr/0037 §4; KK6): questions from confirmed accounts, answers from the shop or buyers. */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    let shop: StockShop
    let storefront: Storefront
    let admin: { headers: Record<string, string> }
    let asker: TestCustomer
    let productId: string
    let variantId: string
    let handle: string

    const post = <T>(path: string, body: unknown, headers: Record<string, string>) =>
      settle(http.post<T & { message?: string }>(path, body, { headers }))
    const ask = (body: string, headers = asker.headers) =>
      post<{ question?: { id: string } }>(
        `/store/products/${productId}/questions`,
        { body },
        headers
      )
    const listed = () =>
      http.get<Listed>(`/store/products/${productId}/questions`, { headers: storefront.headers })
    const pageOf = (id: string) =>
      settle(
        http.get<QuestionPage>(`/store/product-questions/${id}`, { headers: storefront.headers })
      )
    const buyer = async () => {
      const customer = await registerCustomer(http, storefront)
      const orderId = await placeOrder(getContainer(), {
        regionId: shop.regionId,
        salesChannelId: shop.salesChannelId,
        shippingOptionId: shop.shippingOptionId,
        items: [{ variant_id: variantId, quantity: 1 }],
        address: PAYTR_ADDRESS,
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
      return customer
    }

    beforeEach(async () => {
      const container = getContainer()
      await loadTrAddressFixture(container)
      shop = await stockShop(container)
      storefront = await createStorefront(container)
      admin = await createAdminUser(http, container)
      asker = await registerCustomer(http, storefront)
      handle = `tava-${String(Date.now())}`
      ;({ productId, variantId } = await stockedProduct(container, shop, handle, 10, 400))
      await container
        .resolve<PlatformSettingsModuleService>(PLATFORM_SETTINGS_MODULE)
        .saveSection("seo", { canonical_host: "magaza.example.com" }, null)
    })

    it("shows a question once the shop answers it, and gives its own page a QAPage", async () => {
      const asked = await ask("Bu tava indüksiyon ocakta çalışır mı?")
      const id = asked.data.question?.id ?? ""
      const before = await listed()
      const unanswered = await pageOf(id)
      await post(
        `/admin/product-questions/${id}/answer`,
        { body: "Evet, tabanı indüksiyona uygundur." },
        admin.headers
      )
      const after = await listed()
      const page = await pageOf(id)
      const product = await http.get<{ seo?: { jsonLd: Record<string, unknown>[] } }>(
        `/store/seo/resolve?path=${encodeURIComponent(`/urun/${handle}`)}`,
        { headers: storefront.headers }
      )

      expect(asked.status).toBe(201)
      expect(before.data.questions).toEqual([])
      expect(unanswered.status).toBe(404)
      expect(after.data.questions[0]).toMatchObject({
        body: "Bu tava indüksiyon ocakta çalışır mı?",
        answers: [{ body: "Evet, tabanı indüksiyona uygundur.", by_shop: true }],
      })
      expect(page.data.path).toBe(`/urun/${handle}/sorular/${id}`)
      expect(page.data.json_ld).toMatchObject({
        "@type": "QAPage",
        mainEntity: {
          "@type": "Question",
          answerCount: 1,
          acceptedAnswer: { text: "Evet, tabanı indüksiyona uygundur." },
        },
      })
      // The product page lists several questions: never a QAPage there
      expect(JSON.stringify(product.data.seo?.jsonLd ?? [])).not.toContain("QAPage")
    })

    it("takes a customer's answer only from one who received the product, after the shop", async () => {
      const asked = await ask("Sapı ısınıyor mu, tutarken eldiven gerekir mi?")
      const id = asked.data.question?.id ?? ""
      await post(
        "/admin/product-questions/moderate",
        { ids: [id], status: "approved" },
        admin.headers
      )
      const stranger = await post(
        `/store/product-questions/${id}/answers`,
        { body: "Bence ısınmaz ama emin değilim." },
        asker.headers
      )
      const owner = await buyer()
      const answered = await post<{ answer?: { id: string } }>(
        `/store/product-questions/${id}/answers`,
        { body: "Bir yıldır kullanıyorum, sapı ısınmıyor." },
        owner.headers
      )
      const waiting = await pageOf(id)
      await post(
        "/admin/product-answers/moderate",
        { ids: [answered.data.answer?.id ?? ""], status: "approved" },
        admin.headers
      )
      const shown = await pageOf(id)

      expect(stranger.data.message).toBe("questions.answer_purchasers_only")
      expect(answered.status).toBe(201)
      expect(waiting.data.question.answers).toEqual([])
      expect(shown.data.json_ld).toMatchObject({
        mainEntity: {
          answerCount: 1,
          suggestedAnswer: [{ text: "Bir yıldır kullanıyorum, sapı ısınmıyor." }],
        },
      })
    })

    it("lets no one ask without a confirmed sign-in, and checks what is asked", async () => {
      const registration = await http.post<{ token: string }>("/auth/customer/emailpass/register", {
        email: `onaysiz-${randomUUID()}@example.com`,
        password: randomUUID(),
      })
      const unconfirmed = await ask("Doğrulanmamış hesaptan soru.", {
        ...storefront.headers,
        authorization: `Bearer ${registration.data.token}`,
      })
      const anonymous = await ask("Oturumsuz bir soru denemesi.", storefront.headers)
      const tooShort = await ask("Kaç?")

      expect(unconfirmed.status).toBe(401)
      expect(anonymous.status).toBe(401)
      expect(tooShort.status).toBe(400)
    })
  },
})
