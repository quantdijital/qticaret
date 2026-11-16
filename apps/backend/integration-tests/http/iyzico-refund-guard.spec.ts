import { Modules } from "@medusajs/framework/utils"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { fakeIyzicoAccount, startFakeIyzico } from "@qticaret/testing"
import type { FakeIyzico } from "@qticaret/testing"
import paymentRecovery from "../../src/jobs/payment-recovery"
import { IYZICO_PAYMENT_PROVIDER_ID } from "../../src/lib/payments/checkout"
import { PAYMENT_RECOVERY_MODULE } from "../../src/modules/payment-recovery"
import type PaymentRecoveryModuleService from "../../src/modules/payment-recovery/service"
import type { HttpClient } from "../helpers/http"
import { connectIyzico, postIyzicoCallback, startIyzicoPayment } from "../helpers/iyzico"
import { orderOfCart, readyCart, storeReturnUrls } from "../helpers/paytr"
import { stockShop, stockedProduct } from "../helpers/stock"
import type { StockShop } from "../helpers/stock"
import { createStorefront } from "../helpers/storefront"
import type { Storefront } from "../helpers/storefront"
import { loadTrAddressFixture } from "../helpers/tr-address"

jest.setTimeout(120 * 1000)

const account = fakeIyzicoAccount()
const RETRIEVE = "/payment/iyzipos/checkoutform/auth/ecom/detail"
const MONEY_BACK = ["/payment/cancel", "/payment/refund"]

/**
 * Finding 2026-11-16: a shopper re-posting iyzico's callback (its signature
 * binds only the session) could have a placed order's money given back. A
 * form the order already holds is answered as paid, iyzico not asked, and
 * nothing recorded; a record left by the old completion is stopped.
 */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    const base = () => (api as { defaults: { baseURL?: string } }).defaults.baseURL ?? ""
    let fake: FakeIyzico
    let shop: StockShop
    let storefront: Storefront
    let variantId: string

    const recoveries = () =>
      getContainer().resolve<PaymentRecoveryModuleService>(PAYMENT_RECOVERY_MODULE)
    const asked = (paths: string[]) =>
      fake.requests.filter(({ path }) => paths.includes(path)).length

    /** A cart paid with iyzico's form and placed by the shopper's return. */
    const placedOrder = async () => {
      const cartId = await readyCart(getContainer(), shop, variantId)
      const started = await startIyzicoPayment(http, storefront.headers, cartId)
      const form = fake.pay(started.token)
      const back = await postIyzicoCallback(
        base(),
        started.sessionId,
        started.token,
        account.secretKey
      )
      const orderId = await orderOfCart(getContainer(), cartId)
      if (back.status !== 303 || !orderId) {
        throw new Error("the order did not open")
      }
      return { cartId, started, orderId, paymentId: form.result?.paymentId ?? "" }
    }

    /** The cart's collection moved on after the order: any rule judging it again would refuse it. */
    const changeCollection = async () => {
      const payments = getContainer().resolve(Modules.PAYMENT)
      const [session] = await payments.listPaymentSessions(
        { provider_id: IYZICO_PAYMENT_PROVIDER_ID },
        { select: ["payment_collection_id"] }
      )
      await payments.updatePaymentCollections(session?.payment_collection_id ?? "", { amount: 300 })
    }

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
      await connectIyzico(http, container, account)
    })

    it("lands a re-posted callback on the order, asking iyzico nothing and giving nothing back", async () => {
      const { cartId, started, orderId } = await placedOrder()
      await changeCollection()
      const retrievedBefore = asked([RETRIEVE])

      const again = await postIyzicoCallback(
        base(),
        started.sessionId,
        started.token,
        account.secretKey
      )
      await paymentRecovery(getContainer())

      expect(again.status).toBe(303)
      expect(again.headers.get("location")).toBe(storeReturnUrls().success)
      expect(asked([RETRIEVE])).toBe(retrievedBefore)
      expect(await recoveries().listPaymentRecoveries({ provider: "iyzico" })).toEqual([])
      expect(asked(MONEY_BACK)).toBe(0)
      expect(await orderOfCart(getContainer(), cartId)).toBe(orderId)
    })

    it("never refunds a payment recorded to be given back whose cart is an order", async () => {
      const { cartId, started, orderId, paymentId } = await placedOrder()
      // As the old completion recorded it on a re-posted callback
      const { id } = await recoveries().recordOrphan({
        provider: "iyzico",
        reference: paymentId,
        reason: "completion_failed",
        amount: 21000,
        currency_code: "try",
        test_mode: true,
        cart_id: cartId,
      })

      const again = await postIyzicoCallback(
        base(),
        started.sessionId,
        started.token,
        account.secretKey
      )
      await paymentRecovery(getContainer())
      await paymentRecovery(getContainer())

      // The shopper is shown the order, not a refund
      expect(again.headers.get("location")).toBe(storeReturnUrls().success)
      expect(asked(MONEY_BACK)).toBe(0)
      expect(await recoveries().retrievePaymentRecovery(id)).toMatchObject({
        status: "order_exists",
        refunded_at: null,
      })
      expect(await orderOfCart(getContainer(), cartId)).toBe(orderId)
    })
  },
})
