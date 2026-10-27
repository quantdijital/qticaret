import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { fakePaytrAccount, paytrNotification, startFakePaytr } from "@qticaret/testing"
import type { FakePaytr } from "@qticaret/testing"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"
import {
  connectPaytr,
  notifyPaytr,
  orderOfCart,
  readyCart,
  startPaytrPayment,
} from "../helpers/paytr"
import { stockShop, stockedProduct } from "../helpers/stock"
import type { StockShop } from "../helpers/stock"
import { createStorefront } from "../helpers/storefront"
import type { Storefront } from "../helpers/storefront"
import { loadTrAddressFixture } from "../helpers/tr-address"

jest.setTimeout(120 * 1000)

const account = fakePaytrAccount()

/** F6.7 (adr/0030): a cardholder's dispute recorded by hand, moved on, its evidence in one file. */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    let fake: FakePaytr
    let shop: StockShop
    let storefront: Storefront
    let variantId: string
    let admin: { headers: Record<string, string> }

    /** A cup and shipping (210 TL), paid with PayTR. */
    const paidOrder = async () => {
      const cartId = await readyCart(getContainer(), shop, variantId)
      const reference = await startPaytrPayment(http, storefront.headers, cartId)
      fake.pay(reference)
      await notifyPaytr(
        http,
        paytrNotification(account, {
          merchantOid: reference,
          status: "success",
          paymentAmount: 21000,
          testMode: true,
        })
      )
      return (await orderOfCart(getContainer(), cartId)) ?? ""
    }
    const open = (body: Record<string, unknown>) =>
      settle(
        http.post<{ chargeback: { id: string; status: string; amount: string }; message?: string }>(
          "/admin/chargebacks",
          body,
          { headers: admin.headers }
        )
      )
    const move = (id: string, body: Record<string, unknown>) =>
      settle(
        http.post<{ chargeback: { status: string; closed_at: string | null }; message?: string }>(
          `/admin/chargebacks/${id}`,
          body,
          { headers: admin.headers }
        )
      )

    beforeAll(async () => {
      fake = await startFakePaytr(account)
      process.env["PAYTR_BASE_URL"] = fake.url
    })

    afterAll(async () => {
      delete process.env["PAYTR_BASE_URL"]
      await fake.close()
    })

    beforeEach(async () => {
      const container = getContainer()
      await loadTrAddressFixture(container)
      shop = await stockShop(container)
      storefront = await createStorefront(container)
      const cup = await stockedProduct(container, shop, `kupa-${String(Date.now())}`, 10, 120)
      variantId = cup.variantId
      admin = await connectPaytr(http, container, account)
    })

    it("records a dispute of a paid order, once, for no more than was paid", async () => {
      const orderId = await paidOrder()

      const opened = await open({
        order_id: orderId,
        amount: 210,
        reason: "not_received",
        provider_reference: "CB-2026-0001",
        due_at: "2026-11-05T12:00:00.000Z",
      })
      const twice = await open({ order_id: orderId, amount: 10, reason: "other" })
      const { data } = await http.get<{ chargebacks: Record<string, unknown>[]; count: number }>(
        `/admin/chargebacks?order_id=${orderId}`,
        { headers: admin.headers }
      )

      // Lira as exact text, like every order amount the panel reads
      expect(opened.data.chargeback).toMatchObject({ status: "open", amount: "210.00" })
      expect(twice.data).toMatchObject({ message: "chargebacks.already_open" })
      expect(data.count).toBe(1)
      expect(data.chargebacks[0]).toMatchObject({
        provider: "paytr",
        order_display_id: expect.any(Number) as unknown,
      })
    })

    it("opens one dispute when the same notice is recorded twice at once", async () => {
      const orderId = await paidOrder()

      const both = await Promise.all([
        open({ order_id: orderId, amount: 20, reason: "duplicate" }),
        open({ order_id: orderId, amount: 20, reason: "duplicate" }),
      ])

      expect(both.map(({ status }) => status).sort()).toEqual([200, 400])
    })

    it("refuses more than was paid", async () => {
      const orderId = await paidOrder()

      const over = await open({ order_id: orderId, amount: 211, reason: "unauthorized" })

      expect(over.data).toMatchObject({ message: "chargebacks.amount_exceeds_paid" })
    })

    it("moves a dispute forward only, and a closed one never again", async () => {
      const orderId = await paidOrder()
      const { data } = await open({ order_id: orderId, amount: 50, reason: "not_as_described" })
      const id = data.chargeback.id

      const sent = await move(id, {
        status: "evidence_submitted",
        note: "Teslim kanıtı gönderildi",
      })
      const lost = await move(id, { status: "lost" })
      const reopened = await move(id, { status: "won" })

      expect(sent.data.chargeback).toMatchObject({ status: "evidence_submitted", closed_at: null })
      expect(lost.data.chargeback.status).toBe("lost")
      expect(lost.data.chargeback.closed_at).not.toBeNull()
      expect(reopened.data).toMatchObject({ message: "chargebacks.transition_invalid" })
    })

    it("hands the evidence over as one self-contained file", async () => {
      const orderId = await paidOrder()
      const { data } = await open({
        order_id: orderId,
        amount: 210,
        reason: "not_received",
        provider_reference: "CB-<b>bold</b>",
      })

      const evidence = await http.get<string>(`/admin/chargebacks/${data.chargeback.id}/evidence`, {
        headers: admin.headers,
        responseType: "text",
      })

      expect(evidence.headers["content-disposition"]).toMatch(/^attachment; filename="ters-ibraz-/)
      expect(evidence.data).toContain("Ters ibraz belgeleri")
      expect(evidence.data).toContain("Teslimat adresi")
      expect(evidence.data).toContain("Ödeme (sağlayıcının kaydı)")
      expect(evidence.data).toContain("CB-&#60;b&#62;bold&#60;/b&#62;")
      expect(evidence.data).not.toMatch(/<script|<b>bold/)
    })
  },
})
