import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { fakeIyzicoAccount, startFakeIyzico } from "@qticaret/testing"
import type { FakeIyzico } from "@qticaret/testing"
import paymentRecovery from "../../src/jobs/payment-recovery"
import { ORDER_REFUNDS_MODULE } from "../../src/modules/order-refunds"
import type OrderRefundsModuleService from "../../src/modules/order-refunds/service"
import { PAYMENT_RECOVERY_MODULE } from "../../src/modules/payment-recovery"
import type PaymentRecoveryModuleService from "../../src/modules/payment-recovery/service"
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

/** F5 V10: money back on an iyzico order, by item transaction, each part sent once. */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    const base = () => (api as { defaults: { baseURL?: string } }).defaults.baseURL ?? ""
    let fake: FakeIyzico
    let shop: StockShop
    let storefront: Storefront
    let variantId: string
    let admin: { headers: Record<string, string> }

    /** Two cups (120 each) and shipping (90), paid with iyzico: 330 TL. */
    const paidOrder = async () => {
      const cartId = await readyCart(getContainer(), shop, variantId, undefined, 2)
      const started = await startIyzicoPayment(http, storefront.headers, cartId)
      const form = fake.pay(started.token)
      await postIyzicoCallback(base(), started.sessionId, started.token, account.secretKey)
      return {
        orderId: (await orderOfCart(getContainer(), cartId)) ?? "",
        paymentId: form.result?.paymentId ?? "",
      }
    }
    const firstItem = async (orderId: string) =>
      (
        await http.get<{ money: { lines: { id: string; kind: string }[] } }>(
          `/admin/orders/${orderId}/money`,
          { headers: admin.headers }
        )
      ).data.money.lines.find((line) => line.kind === "item")
    const refund = (orderId: string, body: Record<string, unknown>) =>
      settle(
        http.post<{ refund: { amount: string; made_before: boolean }; message?: string }>(
          `/admin/orders/${orderId}/refunds`,
          body,
          { headers: admin.headers }
        )
      )
    const partsOf = async (reference: string) =>
      (
        await getContainer()
          .resolve<OrderRefundsModuleService>(ORDER_REFUNDS_MODULE)
          .providerParts(reference)
      )?.parts

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

    it("gives back a unit through its item transaction, once per reference", async () => {
      const { orderId, paymentId } = await paidOrder()
      const item = await firstItem(orderId)
      const body = { items: [{ id: item?.id, quantity: 1 }], reference: "refund0000000001" }

      const first = await refund(orderId, body)
      const again = await refund(orderId, body)

      expect(first.data.refund).toMatchObject({ amount: "120.00", made_before: false })
      expect(again.data.refund).toMatchObject({ made_before: true })
      expect(fake.refunds.get(`${paymentId}01`)).toEqual([12000])
      expect(await partsOf("refund0000000001")).toEqual([
        { transaction_id: `${paymentId}01`, amount: 12000, state: "done" },
      ])
    })

    it("splits an amount past one line over the lines, products first", async () => {
      const { orderId, paymentId } = await paidOrder()

      const made = await refund(orderId, { amount: 300, reference: "refund0000000002" })

      expect(made.data.refund.amount).toBe("300.00")
      expect(fake.refunds.get(`${paymentId}01`)).toEqual([24000])
      expect(fake.refunds.get(`${paymentId}02`)).toEqual([6000])
    })

    it("never sends again a part whose answer was lost; the shop is told to check iyzico", async () => {
      const { orderId } = await paidOrder()
      fake.queue(REFUND, { drop: true })

      const lost = await refund(orderId, { amount: 50, reference: "refund0000000003" })
      const again = await refund(orderId, { amount: 50, reference: "refund0000000003" })

      expect(lost.data).toMatchObject({ message: "iyzico.refund_outcome_unknown" })
      expect(again.data).toMatchObject({ message: "iyzico.refund_outcome_unknown" })
      expect(
        fake.requests.filter(
          ({ path, body }) => path === REFUND && body["conversationId"] === "refund0000000003"
        )
      ).toHaveLength(1)
      expect(await partsOf("refund0000000003")).toEqual([
        expect.objectContaining({ amount: 5000, state: "sending" }),
      ])
    })

    it("cancels the whole payment the day iyzico refuses to refund it, and says so for a part", async () => {
      const { orderId, paymentId } = await paidOrder()
      fake.queue(REFUND, failure("10223"))
      const part = await refund(orderId, { amount: 50, reference: "refund0000000004" })
      fake.queue(REFUND, failure("10223"))

      const whole = await refund(orderId, { amount: 330, reference: "refund0000000005" })

      expect(part.data).toMatchObject({ message: "iyzico.refund_same_day" })
      expect(whole.data.refund).toMatchObject({ amount: "330.00" })
      expect(fake.cancelled.has(paymentId)).toBe(true)
    })

    it("shows the shop iyzico's record of the payment, and the refunds made", async () => {
      const { orderId, paymentId } = await paidOrder()
      await refund(orderId, { amount: 30, reference: "refund0000000006" })

      const { data } = await http.get<{ payments: Record<string, unknown>[] }>(
        `/admin/orders/${orderId}/payment-details`,
        { headers: admin.headers }
      )

      expect(data.payments).toEqual([
        expect.objectContaining({
          provider_id: "pp_iyzico_iyzico",
          reference: paymentId,
          available: true,
          amount: "330.00",
          installments: 1,
          card_brand: "MASTER_CARD",
          card_last4: "0008",
          fraud_status: 1,
          refunds: [expect.objectContaining({ amount: "30.00", reference: "refund0000000006" })],
        }),
      ])
    })

    /** A replaced session's paid form, recorded to be given back; iyzico's payment id. */
    const orphanPayment = async () => {
      const cartId = await readyCart(getContainer(), shop, variantId)
      const first = await startIyzicoPayment(http, storefront.headers, cartId)
      await startIyzicoPayment(http, storefront.headers, cartId)
      const form = fake.pay(first.token)
      await postIyzicoCallback(base(), first.sessionId, first.token, account.secretKey)
      return form.result?.paymentId ?? ""
    }
    const recoveryOf = async (paymentId: string) =>
      (
        await getContainer()
          .resolve<PaymentRecoveryModuleService>(PAYMENT_RECOVERY_MODULE)
          .listPaymentRecoveries({ provider: "iyzico", reference: paymentId })
      )[0]

    it("refunds every line of an orphan a cancel no longer takes back", async () => {
      const paymentId = await orphanPayment()
      fake.queue("/payment/cancel", failure("FAKE_NOT_CANCELLABLE"))

      await paymentRecovery(getContainer())

      expect(await recoveryOf(paymentId)).toMatchObject({ status: "refunded" })
      expect(fake.refunds.get(`${paymentId}01`)).toEqual([12000])
      expect(fake.refunds.get(`${paymentId}02`)).toEqual([9000])
    })

    it("leaves an orphan to the shop once a part went back and the next did not", async () => {
      const paymentId = await orphanPayment()
      fake.queue("/payment/cancel", failure("FAKE_NOT_CANCELLABLE"))
      // The shipping line was given back some other way: refunding it again is refused (5093)
      fake.refunds.set(`${paymentId}02`, [9000])

      await paymentRecovery(getContainer())
      await paymentRecovery(getContainer())

      // Tried again, the first line would go back twice: the shop checks iyzico instead
      expect(await recoveryOf(paymentId)).toMatchObject({
        status: "failed",
        error_code: "refund_exceeds_line",
      })
      expect(fake.refunds.get(`${paymentId}01`)).toEqual([12000])
    })

    it("tries an orphan again later when nothing went back", async () => {
      const paymentId = await orphanPayment()
      fake.queue("/payment/cancel", failure("FAKE_NOT_CANCELLABLE"))
      fake.queue(REFUND, failure("10237"))

      await paymentRecovery(getContainer())

      expect(await recoveryOf(paymentId)).toMatchObject({
        status: "pending",
        attempts: 1,
        error_code: "refund_not_supported",
      })
    })

    it("gives back a paid form that became no order, by a cancel the same day", async () => {
      const cartId = await readyCart(getContainer(), shop, variantId)
      const first = await startIyzicoPayment(http, storefront.headers, cartId)
      await startIyzicoPayment(http, storefront.headers, cartId)
      const form = fake.pay(first.token)
      await postIyzicoCallback(base(), first.sessionId, first.token, account.secretKey)

      await paymentRecovery(getContainer())
      const [recovery] = await getContainer()
        .resolve<PaymentRecoveryModuleService>(PAYMENT_RECOVERY_MODULE)
        .listPaymentRecoveries({ provider: "iyzico" })

      expect(recovery).toMatchObject({ status: "refunded", reference: form.result?.paymentId })
      expect(fake.cancelled.has(form.result?.paymentId ?? "")).toBe(true)
    })
  },
})
