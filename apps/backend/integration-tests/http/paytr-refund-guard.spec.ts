import { Modules } from "@medusajs/framework/utils"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { fakePaytrAccount, paytrNotification, startFakePaytr } from "@qticaret/testing"
import type { FakePaytr } from "@qticaret/testing"
import paymentRecovery from "../../src/jobs/payment-recovery"
import { PAYMENT_RECOVERY_MODULE } from "../../src/modules/payment-recovery"
import type PaymentRecoveryModuleService from "../../src/modules/payment-recovery/service"
import { WEBHOOK_EVENTS_MODULE } from "../../src/modules/webhook-events"
import type WebhookEventsModuleService from "../../src/modules/webhook-events/service"
import type { HttpClient } from "../helpers/http"
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

/**
 * Finding 2026-11-16: a placed order's money is never given back, whatever
 * judged its cart again. A notice handled again after the order opened
 * answers with that order; a payment recorded to be given back (as the old
 * completion did) whose cart is an order is stopped, the shop told.
 */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    let fake: FakePaytr
    let shop: StockShop
    let storefront: Storefront
    let variantId: string

    const success = (merchantOid: string) =>
      paytrNotification(account, {
        merchantOid,
        status: "success",
        paymentAmount: 21000,
        testMode: true,
      })
    const recoveries = () =>
      getContainer().resolve<PaymentRecoveryModuleService>(PAYMENT_RECOVERY_MODULE)
    const alerts = async () => {
      const notifications = await getContainer()
        .resolve(Modules.NOTIFICATION)
        .listNotifications({ channel: "feed" }, { select: ["data"] })
      return notifications.flatMap(({ data }) =>
        data?.["kind"] === "payment_recovery" ? [String(data["state"])] : []
      )
    }

    /** A cart paid and placed through PayTR's notice, answered "OK" (refunds possible). */
    const placedOrder = async () => {
      const cartId = await readyCart(getContainer(), shop, variantId)
      const merchantOid = await startPaytrPayment(http, storefront.headers, cartId)
      fake.pay(merchantOid)
      await notifyPaytr(http, success(merchantOid))
      const payment = fake.payments.get(merchantOid)
      if (payment) {
        payment.notified = true
      }
      const orderId = await orderOfCart(getContainer(), cartId)
      if (!orderId) {
        throw new Error("the order did not open")
      }
      return { cartId, merchantOid, orderId }
    }

    /** The cart's collection moved on after the order: any rule judging it again would refuse it. */
    const changeCollection = async () => {
      const payments = getContainer().resolve(Modules.PAYMENT)
      const [session] = await payments.listPaymentSessions(
        { provider_id: "pp_paytr_paytr" },
        { select: ["payment_collection_id"] }
      )
      await payments.updatePaymentCollections(session?.payment_collection_id ?? "", { amount: 300 })
    }

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
      await connectPaytr(http, container, account)
    })

    it("answers a notice handled again after its order with that order, giving nothing back", async () => {
      const { cartId, merchantOid, orderId } = await placedOrder()
      await changeCollection()
      // The first handling's record was left unprocessed (a crash): PayTR sends it again
      const events = getContainer().resolve<WebhookEventsModuleService>(WEBHOOK_EVENTS_MODULE)
      const [event] = await events.listWebhookEvents({
        provider: "paytr",
        event_key: `${merchantOid}:success`,
      })
      await events.markFailed(event?.id ?? "", "processing_failed")

      const again = await notifyPaytr(http, success(merchantOid))
      await paymentRecovery(getContainer())
      const [handled] = await events.listWebhookEvents({ id: event?.id ?? "" })

      expect(again.data).toBe("OK")
      expect(await orderOfCart(getContainer(), cartId)).toBe(orderId)
      expect(await recoveries().listPaymentRecoveries({ provider: "paytr" })).toEqual([])
      expect(fake.payments.get(merchantOid)?.refunds).toEqual([])
      expect(handled).toMatchObject({ status: "processed", summary: { order_id: orderId } })
    })

    it("never refunds a payment recorded to be given back whose cart is an order", async () => {
      const { cartId, merchantOid, orderId } = await placedOrder()
      // As the old completion recorded it: a cart rule refused the repeat of a placed order
      const { id } = await recoveries().recordOrphan({
        provider: "paytr",
        reference: merchantOid,
        reason: "completion_failed",
        amount: 21000,
        currency_code: "try",
        test_mode: true,
        cart_id: cartId,
      })

      await paymentRecovery(getContainer())
      await paymentRecovery(getContainer())

      expect(fake.payments.get(merchantOid)?.refunds).toEqual([])
      expect(await recoveries().retrievePaymentRecovery(id)).toMatchObject({
        status: "order_exists",
        refunded_at: null,
      })
      expect(await orderOfCart(getContainer(), cartId)).toBe(orderId)
      expect(await alerts()).toContain("orphan_order_exists")
      expect(await alerts()).not.toContain("orphan_refunded")
    })

    it("finds the order by the payment's session when the record names no cart", async () => {
      const { merchantOid } = await placedOrder()
      const { id } = await recoveries().recordOrphan({
        provider: "paytr",
        reference: merchantOid,
        reason: "session_gone",
        amount: 21000,
        currency_code: "try",
        test_mode: true,
        cart_id: null,
      })

      await paymentRecovery(getContainer())

      expect(fake.payments.get(merchantOid)?.refunds).toEqual([])
      expect(await recoveries().retrievePaymentRecovery(id)).toMatchObject({
        status: "order_exists",
      })
    })
  },
})
