import { Modules } from "@medusajs/framework/utils"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { fakeIyzicoAccount, startFakeIyzico } from "@qticaret/testing"
import type { FakeIyzico } from "@qticaret/testing"
import paymentRecovery from "../../src/jobs/payment-recovery"
import { ORDER_REFUNDS_MODULE } from "../../src/modules/order-refunds"
import type OrderRefundsModuleService from "../../src/modules/order-refunds/service"
import { PAYMENT_RECOVERY_MODULE } from "../../src/modules/payment-recovery"
import type PaymentRecoveryModuleService from "../../src/modules/payment-recovery/service"
import { settleOpenRefunds } from "../../src/workflows/orders/settle-open-refunds"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"
import { connectIyzico, postIyzicoCallback, startIyzicoPayment } from "../helpers/iyzico"
import { orderOfCart, readyCart } from "../helpers/paytr"
import { stockShop, stockedProduct } from "../helpers/stock"
import type { StockShop } from "../helpers/stock"
import { createStorefront } from "../helpers/storefront"
import type { Storefront } from "../helpers/storefront"
import { loadTrAddressFixture } from "../helpers/tr-address"

jest.setTimeout(120 * 1000)

const account = fakeIyzicoAccount()
const REFUND = "/payment/refund"
const failure = (errorCode: string) => ({
  body: { status: "failure", errorCode, errorMessage: "x", locale: "tr", systemTime: 0 },
})

/**
 * Security review 2026-10-27: iyzico money moves once. A part whose outcome
 * is unknown stops every later refund of the payment; a payment recorded to
 * be given back never becomes an order; an orphan is refunded only from
 * figures that add up, and left to the shop once anything may have gone.
 */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    const base = () => (api as { defaults: { baseURL?: string } }).defaults.baseURL ?? ""
    let fake: FakeIyzico
    let shop: StockShop
    let storefront: Storefront
    let variantId: string
    let admin: { headers: Record<string, string> }

    /** Two cups (120 each) and shipping (90): 330 TL, paid; the cart, the order and iyzico's payment. */
    const paidOrder = async () => {
      const cartId = await readyCart(getContainer(), shop, variantId, undefined, 2)
      const started = await startIyzicoPayment(http, storefront.headers, cartId)
      const form = fake.pay(started.token)
      await postIyzicoCallback(base(), started.sessionId, started.token, account.secretKey)
      return {
        cartId,
        orderId: (await orderOfCart(getContainer(), cartId)) ?? "",
        paymentId: form.result?.paymentId ?? "",
      }
    }
    const refund = (orderId: string, body: Record<string, unknown>) =>
      settle(
        http.post<{ refund: { amount: string }; message?: string }>(
          `/admin/orders/${orderId}/refunds`,
          body,
          { headers: admin.headers }
        )
      )
    const ledger = () => getContainer().resolve<OrderRefundsModuleService>(ORDER_REFUNDS_MODULE)
    const recoveries = () =>
      getContainer().resolve<PaymentRecoveryModuleService>(PAYMENT_RECOVERY_MODULE)
    const sentFor = (reference: string) =>
      fake.requests.filter(
        ({ path, body }) => path === REFUND && body["conversationId"] === reference
      ).length

    beforeAll(async () => {
      fake = await startFakeIyzico(account)
      process.env["IYZICO_BASE_URL"] = fake.url
    })

    afterAll(async () => {
      delete process.env["IYZICO_BASE_URL"]
      await fake.close()
    })

    beforeEach(async () => {
      const container = getContainer()
      await loadTrAddressFixture(container)
      shop = await stockShop(container)
      storefront = await createStorefront(container)
      const cup = await stockedProduct(container, shop, `kupa-${String(Date.now())}`, 10, 120)
      variantId = cup.variantId
      admin = await connectIyzico(http, container, account)
    })

    it("refuses any further refund of a payment while a part's outcome is unknown", async () => {
      const { orderId } = await paidOrder()
      fake.queue(REFUND, { drop: true })

      const lost = await refund(orderId, {
        amount: 50,
        reference: "e0000000000000000000000000000001",
      })
      const other = await refund(orderId, {
        amount: 20,
        reference: "e0000000000000000000000000000002",
      })

      expect(lost.data).toMatchObject({ message: "iyzico.refund_outcome_unknown" })
      expect(other.data).toMatchObject({ message: "iyzico.refund_outcome_unknown" })
      expect(sentFor("e0000000000000000000000000000002")).toBe(0)
    })

    it("treats an answer that is not iyzico's, or not for the part, as unknown: never sent again", async () => {
      const { orderId, paymentId } = await paidOrder()
      fake.queue(REFUND, {
        body: {
          status: "success",
          paymentId,
          price: 50,
          currency: "TRY",
          conversationId: "e0000000000000000000000000000003",
          signature: "0".repeat(64),
        },
      })

      const forged = await refund(orderId, {
        amount: 50,
        reference: "e0000000000000000000000000000003",
      })
      const [open] = await ledger().listOrderRefunds({
        reference: "e0000000000000000000000000000003",
      })
      const again = await refund(orderId, {
        amount: 50,
        reference: "e0000000000000000000000000000003",
      })
      const entry = await ledger().providerParts("e0000000000000000000000000000003")

      expect(forged.data).toMatchObject({ message: "iyzico.refund_outcome_unknown" })
      // An answer not iyzico's is no refusal: the refund stays open, never failed (review O-1)
      expect(open).toMatchObject({ status: "pending", error_code: "refund_incomplete" })
      // Tried again, an open refund is never sent: the shop settles it (review O1)
      expect(again.status).toBe(409)
      expect(again.data).toMatchObject({ message: "orders.refund_unsettled" })
      expect(entry?.parts).toEqual([expect.objectContaining({ amount: 5000, state: "sending" })])
      expect(sentFor("e0000000000000000000000000000003")).toBe(1)
    })

    it("lets staff settle a part whose answer was lost, and the payment refunds again (O-2)", async () => {
      const { orderId } = await paidOrder()
      fake.queue(REFUND, { drop: true })
      const lostRef = "e0000000000000000000000000000006"
      await refund(orderId, { amount: 50, reference: lostRef })
      // While that part's answer is unknown, no refund of the payment may go
      const blocked = await refund(orderId, {
        amount: 20,
        reference: "e0000000000000000000000000000007",
      })

      const checked = await settle(
        http.post<{ refund?: { status: string } }>(
          `/admin/orders/${orderId}/refunds/${lostRef}/settle`,
          { outcome: "not_made" },
          { headers: admin.headers }
        )
      )
      const next = await refund(orderId, {
        amount: 20,
        reference: "e0000000000000000000000000000008",
      })
      const [closed] = await ledger().listOrderRefunds({ reference: lostRef })

      expect(blocked.data).toMatchObject({ message: "iyzico.refund_outcome_unknown" })
      expect(checked.data.refund).toMatchObject({ status: "failed" })
      expect(closed).toMatchObject({ status: "failed", provider_parts: [] })
      expect(next.data.refund).toMatchObject({ amount: "20.00" })
      expect(sentFor(lostRef)).toBe(1)
    })

    it("closes a staff 'made' cut short once its parts were written; the payment refunds again (O4-1)", async () => {
      const { orderId } = await paidOrder()
      fake.queue(REFUND, { drop: true })
      const lostRef = "e0000000000000000000000000000009"
      await refund(orderId, { amount: 50, reference: lostRef })
      // The check stops after the parts were written: Medusa's record cannot be made
      const payments = getContainer().resolve(Modules.PAYMENT) as unknown as {
        createRefunds: (...args: unknown[]) => Promise<unknown>
      }
      const broken = jest
        .spyOn(payments, "createRefunds")
        .mockRejectedValueOnce(new Error("database gone"))
      const cut = await settle(
        http.post(
          `/admin/orders/${orderId}/refunds/${lostRef}/settle`,
          { outcome: "made" },
          { headers: admin.headers }
        )
      )
      broken.mockRestore()

      const round = await settleOpenRefunds(getContainer(), Date.now() + 3 * 60 * 1000)
      const [closed] = await ledger().listOrderRefunds({ reference: lostRef })
      const next = await refund(orderId, {
        amount: 20,
        reference: "e0000000000000000000000000000010",
      })

      expect(cut.status).toBeGreaterThanOrEqual(400)
      expect(round).toMatchObject({ closed: 1 })
      expect(closed).toMatchObject({
        status: "done",
        provider_parts: [expect.objectContaining({ state: "done" })],
      })
      expect(next.data.refund).toMatchObject({ amount: "20.00" })
      // Nothing sent again for the part whose answer was lost
      expect(sentFor(lostRef)).toBe(1)
    })

    it("keeps a refund that went part way pending, its sent part counted, never sent twice", async () => {
      const { orderId, paymentId } = await paidOrder()
      // The shipping line went back some other way: its part is refused (5093)
      fake.refunds.set(`${paymentId}02`, [9000])

      const halfway = await refund(orderId, {
        amount: 300,
        reference: "e0000000000000000000000000000004",
      })
      const [entry] = await ledger().listOrderRefunds({
        reference: "e0000000000000000000000000000004",
      })
      const next = await refund(orderId, {
        amount: 30,
        reference: "e0000000000000000000000000000005",
      })

      expect(halfway.data).toMatchObject({ message: "iyzico.refund_exceeds_line" })
      expect(entry).toMatchObject({ status: "pending", error_code: "refund_incomplete" })
      expect(entry?.provider_parts).toEqual([
        { transaction_id: `${paymentId}01`, amount: 24000, state: "done" },
      ])
      // The product line is spent: the next refund does not send to it again
      expect(next.status).toBe(400)
      expect(fake.refunds.get(`${paymentId}01`)).toEqual([24000])
    })

    it("never completes a cart with a payment recorded to be given back", async () => {
      const cartId = await readyCart(getContainer(), shop, variantId)
      const started = await startIyzicoPayment(http, storefront.headers, cartId)
      const form = fake.pay(started.token)
      await recoveries().recordOrphan({
        provider: "iyzico",
        reference: form.result?.paymentId ?? "",
        reason: "completion_failed",
        amount: 21000,
        currency_code: "try",
        test_mode: true,
        cart_id: cartId,
      })

      await settle(
        http.post(`/store/carts/${cartId}/complete`, {}, { headers: storefront.headers })
      )

      expect(await orderOfCart(getContainer(), cartId)).toBeNull()
    })

    /** A replaced session's paid form: an orphan to give back, by iyzico's payment id. */
    const orphan = async () => {
      const cartId = await readyCart(getContainer(), shop, variantId)
      const first = await startIyzicoPayment(http, storefront.headers, cartId)
      await startIyzicoPayment(http, storefront.headers, cartId)
      const form = fake.pay(first.token)
      await postIyzicoCallback(base(), first.sessionId, first.token, account.secretKey)
      return form.result?.paymentId ?? ""
    }
    const recoveryOf = async (paymentId: string) =>
      (await recoveries().listPaymentRecoveries({ provider: "iyzico", reference: paymentId }))[0]

    it("refunds no orphan from a payment detail that does not add up", async () => {
      const paymentId = await orphan()
      fake.queue("/payment/cancel", failure("FAKE_NOT_CANCELLABLE"))
      fake.queue("/payment/detail", {
        body: { status: "success", paymentId, itemTransactions: [] },
      })

      await paymentRecovery(getContainer())

      expect(await recoveryOf(paymentId)).toMatchObject({
        status: "pending",
        error_code: "detail_mismatch",
      })
      expect(fake.refunds.get(`${paymentId}01`)).toBeUndefined()
    })

    it("leaves an orphan to the shop when a cancel's answer was lost", async () => {
      const paymentId = await orphan()
      fake.queue("/payment/cancel", { drop: true })

      await paymentRecovery(getContainer())
      await paymentRecovery(getContainer())

      expect(await recoveryOf(paymentId)).toMatchObject({
        status: "failed",
        error_code: "outcome_unknown",
      })
      expect(fake.refunds.get(`${paymentId}01`)).toBeUndefined()
    })
  },
})
