import { Modules } from "@medusajs/framework/utils"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { fakePaytrAccount, paytrNotification, startFakePaytr } from "@qticaret/testing"
import type { FakePaytr } from "@qticaret/testing"
import paymentRecovery from "../../src/jobs/payment-recovery"
import { reconcilePaytrSessions } from "../../src/jobs/paytr-reconcile"
import { PAYMENT_RECOVERY_MODULE } from "../../src/modules/payment-recovery"
import type PaymentRecoveryModuleService from "../../src/modules/payment-recovery/service"
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

// A made-up PayTR account, fresh per run; the fake server checks every signature with it
const account = fakePaytrAccount()

/** F5 V4 (adr/0026 §6, §7): money that became no order goes back; a lost notification is found. */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    let fake: FakePaytr
    let shop: StockShop
    let storefront: Storefront
    let variantId: string
    let admin: { headers: Record<string, string> }

    const success = (merchantOid: string) =>
      paytrNotification(account, {
        merchantOid,
        status: "success",
        paymentAmount: 21000,
        testMode: true,
      })
    const recoveries = () =>
      getContainer()
        .resolve<PaymentRecoveryModuleService>(PAYMENT_RECOVERY_MODULE)
        .listPaymentRecoveries({ provider: "paytr" })
    const alerts = async () => {
      const notifications = await getContainer()
        .resolve(Modules.NOTIFICATION)
        .listNotifications({ channel: "feed" }, { select: ["data"] })
      return notifications.flatMap(({ data }) =>
        data?.["kind"] === "payment_recovery" ? [String(data["state"])] : []
      )
    }
    /** PayTR marks a payment notified once the shop answered "OK"; the test posts the notification itself. */
    const acknowledged = (merchantOid: string) => {
      const payment = fake.payments.get(merchantOid)
      if (payment) {
        payment.notified = true
      }
    }

    beforeAll(async () => {
      fake = await startFakePaytr(account)
      // Read on the first PayTR call (lib/payments/paytr/client.ts)
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

    it("gives back a payment made for a replaced session, once", async () => {
      const cartId = await readyCart(getContainer(), shop, variantId)
      const first = await startPaytrPayment(http, storefront.headers, cartId)
      // The shopper starts again: the first session goes, its token stays payable
      await startPaytrPayment(http, storefront.headers, cartId)
      fake.pay(first)

      const answer = await notifyPaytr(http, success(first))
      acknowledged(first)
      const tasks = () =>
        http.get<{ orphan_payments: Record<string, number> }>("/admin/dashboard/tasks", {
          headers: admin.headers,
        })
      const waiting = (await tasks()).data.orphan_payments
      await paymentRecovery(getContainer())
      await paymentRecovery(getContainer())

      expect(answer.data).toBe("OK")
      expect(waiting).toEqual({ refunding: 1, by_hand: 0 })
      expect((await tasks()).data.orphan_payments).toEqual({ refunding: 0, by_hand: 0 })
      expect(await orderOfCart(getContainer(), cartId)).toBeNull()
      expect(await recoveries()).toEqual([
        expect.objectContaining({ reason: "session_gone", status: "refunded", amount: 21000 }),
      ])
      expect(fake.payments.get(first)?.refunds).toEqual([
        { amount: 21000, referenceNo: `R${first}` },
      ])
      expect(await alerts()).toEqual(expect.arrayContaining(["orphan_recorded", "orphan_refunded"]))
    })

    it("gives back a payment whose cart could no longer be completed", async () => {
      const container = getContainer()
      const cartId = await readyCart(container, shop, variantId)
      const reference = await startPaytrPayment(http, storefront.headers, cartId)
      fake.pay(reference)
      const [session] = await container
        .resolve(Modules.PAYMENT)
        .listPaymentSessions(
          { provider_id: "pp_paytr_paytr" },
          { select: ["payment_collection_id"] }
        )
      // The cart's collection moved on after the payment: the order cannot be placed
      await container
        .resolve(Modules.PAYMENT)
        .updatePaymentCollections(session?.payment_collection_id ?? "", { amount: 300 })

      const answer = await notifyPaytr(http, success(reference))
      acknowledged(reference)
      await paymentRecovery(container)

      expect(answer.data).toBe("OK")
      expect(await orderOfCart(container, cartId)).toBeNull()
      expect(await recoveries()).toEqual([
        expect.objectContaining({
          reason: "completion_failed",
          status: "refunded",
          cart_id: cartId,
        }),
      ])
    })

    it("does not refund twice when the first refund's answer was lost", async () => {
      const cartId = await readyCart(getContainer(), shop, variantId)
      const first = await startPaytrPayment(http, storefront.headers, cartId)
      await startPaytrPayment(http, storefront.headers, cartId)
      fake.pay(first)
      await notifyPaytr(http, success(first))
      acknowledged(first)
      // PayTR made the refund, but its answer never arrived (outcome unknown)
      fake.payments.get(first)?.refunds.push({ amount: 21000, referenceNo: `R${first}` })

      await paymentRecovery(getContainer())

      expect(fake.payments.get(first)?.refunds).toHaveLength(1)
      expect((await recoveries())[0]).toMatchObject({ status: "refunded" })
    })

    it("places the order for a payment whose notification never came", async () => {
      const cartId = await readyCart(getContainer(), shop, variantId)
      const reference = await startPaytrPayment(http, storefront.headers, cartId)
      fake.pay(reference)

      const placed = await reconcilePaytrSessions(getContainer(), { quietMs: 0 })
      const late = await notifyPaytr(http, success(reference))

      expect(placed).toBe(1)
      expect(await orderOfCart(getContainer(), cartId)).toMatch(/^order_/)
      // The notification arriving after all is only acknowledged
      expect(late.data).toBe("OK")
    })
  },
})
