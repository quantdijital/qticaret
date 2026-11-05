import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { orderAccessKey, orderAccessToken } from "../../src/lib/orders"
import { chargebackEvidence } from "../../src/workflows/chargebacks/evidence"
import { createAdminUser } from "../helpers/admin"
import { eventually } from "../helpers/eventually"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"
import { readyCart } from "../helpers/paytr"
import { stockShop, stockedProduct } from "../helpers/stock"
import type { StockShop } from "../helpers/stock"
import { createStorefront } from "../helpers/storefront"
import type { Storefront } from "../helpers/storefront"
import { loadTrAddressFixture } from "../helpers/tr-address"

jest.setTimeout(120 * 1000)

const COD = "pp_cod_cod"

const doc = (...texts: string[]) => ({
  type: "doc",
  content: texts.map((text) => ({ type: "paragraph", content: [{ type: "text", text }] })),
})

interface Record_ {
  consent: {
    given_at: string
    ip: string | null
    documents: { kind: string; version: number }[]
    copies: { kind: string; version: number; html_hash: string }[]
  } | null
}

/** F13.2 (adr/0041 §2; KK1): the contracts accepted before paying, and kept with the order. */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    let shop: StockShop
    let storefront: Storefront
    let variantId: string
    let admin: { headers: Record<string, string> }

    const asAdmin = <T>(method: "get" | "post", url: string, body: unknown = {}) =>
      settle(
        method === "get"
          ? http.get<T & { message?: string }>(url, { headers: admin.headers })
          : http.post<T & { message?: string }>(url, body, { headers: admin.headers })
      )
    const publish = async (kind: string, ...texts: string[]) => {
      await asAdmin("post", `/admin/legal-documents/${kind}/draft`, {
        title: kind === "distance_sales" ? "Mesafeli satış sözleşmesi" : "Ön bilgilendirme formu",
        body: doc(...texts),
      })
      const published = await asAdmin("post", `/admin/legal-documents/${kind}/publish`)
      if (published.status !== 200) {
        throw new Error(`publishing ${kind} answered ${String(published.status)}`)
      }
    }
    const accept = (cartId: string, documents: { kind: string; version: number }[]) =>
      settle(
        http.post<{ consent: { documents: unknown[] }; message?: string }>(
          `/store/carts/${cartId}/legal-consents`,
          { documents },
          { headers: storefront.headers }
        )
      )
    const start = (cartId: string) =>
      settle(
        http.post<{ message?: string }>(
          `/store/carts/${cartId}/payment-session`,
          { provider_id: COD },
          { headers: storefront.headers }
        )
      )

    beforeEach(async () => {
      const container = getContainer()
      await loadTrAddressFixture(container)
      shop = await stockShop(container)
      storefront = await createStorefront(container)
      variantId = (await stockedProduct(container, shop, `kupa-${String(Date.now())}`, 10, 120))
        .variantId
      admin = await createAdminUser(http, container)
      await asAdmin("post", "/admin/platform-settings/cash_on_delivery", {
        fee_type: "none",
        fee_value: 0,
        max_amount: 100_000,
        shipping_option_ids: [shop.shippingOptionId],
      })
      await asAdmin("post", "/admin/features/payments.cash_on_delivery", { enabled: true })
    })

    it("asks for the contracts before the payment, again once one changes, and keeps the order's copy", async () => {
      const container = getContainer()
      const early = await readyCart(container, shop, variantId)
      // While the shop has published none there is nothing to accept
      const nothing = await accept(early, [{ kind: "distance_sales", version: 1 }])

      await publish(
        "distance_sales",
        "Alıcı {alıcı_adı}; sipariş {sipariş_no}; toplam {toplam}; ödeme {ödeme_yöntemi}.",
        "{sipariş_kalemleri}"
      )
      await publish("pre_information", "Teslimat adresi: {teslimat_adresi}.")
      const cartId = await readyCart(container, shop, variantId)
      const unaccepted = await start(cartId)
      const shown = await settle(
        http.get<{ document: { version: number; html: string } }>(
          `/store/carts/${cartId}/legal/distance_sales?payment=cash_on_delivery`,
          { headers: storefront.headers }
        )
      )
      const notOrderKind = await settle(
        http.get(`/store/carts/${cartId}/legal/return_policy`, { headers: storefront.headers })
      )
      const stale = await accept(cartId, [
        { kind: "distance_sales", version: 1 },
        { kind: "pre_information", version: 9 },
      ])
      const halfway = await accept(cartId, [{ kind: "distance_sales", version: 1 }])
      const first = await accept(cartId, [
        { kind: "distance_sales", version: 1 },
        { kind: "pre_information", version: 1 },
      ])
      // Published again after the shopper accepted: shown and accepted anew
      await publish("distance_sales", "Yeni metin. Alıcı {alıcı_adı}; ödeme {ödeme_yöntemi}.")
      const outdated = await start(cartId)
      await accept(cartId, [
        { kind: "distance_sales", version: 2 },
        { kind: "pre_information", version: 1 },
      ])
      const started = await start(cartId)
      const completed = await settle(
        http.post<{ order?: { id: string; email: string } }>(
          `/store/carts/${cartId}/complete`,
          {},
          { headers: storefront.headers }
        )
      )
      const orderId = completed.data.order?.id ?? ""
      const record = await eventually(
        async () => (await asAdmin<Record_>("get", `/admin/orders/${orderId}/legal`)).data,
        (data) => (data.consent?.copies.length ?? 0) === 2
      )
      const copy = await asAdmin<{ document: { html: string; version: number; intact: boolean } }>(
        "get",
        `/admin/orders/${orderId}/legal/distance_sales`
      )
      const token = orderAccessToken(orderAccessKey(), {
        id: orderId,
        email: "ayse.yilmaz@example.com",
      })
      const forShopper = await settle(
        http.get<{ document: { html: string } }>(`/store/orders/${orderId}/legal/pre_information`, {
          headers: { ...storefront.headers, "x-order-token": token },
        })
      )
      const forStranger = await settle(
        http.get(`/store/orders/${orderId}/legal/pre_information`, { headers: storefront.headers })
      )
      const evidence = await chargebackEvidence(container, {
        id: "cb_test",
        order_id: orderId,
        payment_id: "pay_test",
        provider: "cod",
        provider_reference: null,
        amount: 0,
        currency_code: "try",
        reason: "other",
        status: "open",
        due_at: null,
        created_at: new Date(),
      })

      expect(nothing.status).toBe(400)
      expect(nothing.data.message).toBe("legal.nothing_to_accept")
      expect(unaccepted.status).toBe(400)
      expect(unaccepted.data.message).toBe("legal.consent_missing")
      expect(shown.data.document.version).toBe(1)
      expect(shown.data.document.html).toContain("Alıcı Ayşe Yılmaz; sipariş —")
      expect(shown.data.document.html).toContain("ödeme Kapıda ödeme")
      expect(notOrderKind.status).toBe(404)
      expect([stale.status, halfway.status]).toEqual([409, 409])
      expect(stale.data.message).toBe("legal.version_changed")
      expect(first.status).toBe(200)
      expect(outdated.data.message).toBe("legal.version_changed")
      expect(started.status).toBe(200)
      expect(completed.status).toBe(200)
      expect(record.consent).toMatchObject({
        documents: [
          { kind: "distance_sales", version: 2 },
          { kind: "pre_information", version: 1 },
        ],
      })
      expect(record.consent?.ip).toEqual(expect.any(String))
      expect(copy.data.document).toMatchObject({ version: 2, intact: true })
      expect(copy.data.document.html).toContain(
        "Yeni metin. Alıcı Ayşe Yılmaz; ödeme Kapıda ödeme."
      )
      expect(forShopper.status).toBe(200)
      expect(forShopper.data.document.html).toContain(
        "Atatürk Cad. No: 1, 34710 Kadıköy / İstanbul"
      )
      expect(forStranger.status).toBe(404)
      expect(evidence).toContain("Alıcının IP adresi")
      expect(evidence).toContain("Yeni metin. Alıcı Ayşe Yılmaz")
    })
  },
})
