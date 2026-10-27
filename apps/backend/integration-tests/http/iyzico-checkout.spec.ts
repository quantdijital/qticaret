import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { fakeIyzicoAccount, startFakeIyzico } from "@qticaret/testing"
import type { FakeIyzico } from "@qticaret/testing"
import { reconcileIyzicoSessions } from "../../src/jobs/iyzico-reconcile"
import { parseEnv } from "../../src/lib/env"
import { callbackSignature } from "../../src/lib/payments/iyzico"
import { PAYMENT_FORMS_MODULE } from "../../src/modules/payment-forms"
import type PaymentFormsModuleService from "../../src/modules/payment-forms/service"
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

// A made-up sandbox account, fresh per run; the fake server checks every signature with it
const account = fakeIyzicoAccount()

/** F5 V9: iyzico's Checkout Form, from the storefront's start to the shopper's return. */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    const base = () => (api as { defaults: { baseURL?: string } }).defaults.baseURL ?? ""
    let fake: FakeIyzico
    let shop: StockShop
    let storefront: Storefront
    let variantId: string

    const paymentData = async (orderId: string) => {
      const { data } = await getContainer()
        .resolve(ContainerRegistrationKeys.QUERY)
        .graph({
          entity: "order",
          fields: ["payment_collections.payments.data"],
          filters: { id: orderId },
        })
      return (
        data[0] as { payment_collections: { payments: { data: Record<string, unknown> }[] }[] }
      ).payment_collections[0]?.payments[0]?.data
    }

    const recoveriesOf = () =>
      getContainer()
        .resolve<PaymentRecoveryModuleService>(PAYMENT_RECOVERY_MODULE)
        .listPaymentRecoveries({ provider: "iyzico" })

    beforeAll(async () => {
      fake = await startFakeIyzico(account)
      // Read on the first iyzico call (lib/payments/iyzico/client.ts), for both modes
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

    it("opens a form from the stored cart; the session shows nothing personal", async () => {
      const cartId = await readyCart(getContainer(), shop, variantId)

      const started = await startIyzicoPayment(http, storefront.headers, cartId)
      const form = fake.forms.get(started.token)

      expect(started.data).toMatchObject({
        checkout: null,
        conversation_id: started.sessionId,
        amount: 21000,
        test_mode: true,
        return_urls: storeReturnUrls(),
        form_url: `${fake.url}/fake-cpp/${started.token}`,
      })
      expect(form).toMatchObject({ price: "210.00", basketId: started.sessionId })
      expect(form?.callbackUrl).toBe(
        `http://localhost:9000/hooks/iyzico/callback?session=${started.sessionId}&sig=${callbackSignature(account.secretKey, started.sessionId)}`
      )
      // Full values: "payses_" itself contains "ayse"
      expect(JSON.stringify(started.data)).not.toMatch(/ayse\.yilmaz|Yılmaz|05320000000/)
    })

    it("places the order when the shopper returns paid; a second return finds the same order", async () => {
      const cartId = await readyCart(getContainer(), shop, variantId)
      const started = await startIyzicoPayment(http, storefront.headers, cartId)
      fake.pay(started.token, { installment: 3 })

      const back = await postIyzicoCallback(
        base(),
        started.sessionId,
        started.token,
        account.secretKey
      )
      const orderId = await orderOfCart(getContainer(), cartId)
      const again = await postIyzicoCallback(
        base(),
        started.sessionId,
        started.token,
        account.secretKey
      )

      expect(back.status).toBe(303)
      expect(back.headers.get("location")).toBe(storeReturnUrls().success)
      expect(orderId).toMatch(/^order_/)
      expect(again.headers.get("location")).toBe(storeReturnUrls().success)
      expect(await orderOfCart(getContainer(), cartId)).toBe(orderId)
      // Kept for refunds by line (F5 V10); nothing about the card (session data is public)
      const kept = await paymentData(orderId ?? "")
      expect(JSON.stringify(kept)).not.toMatch(/card_|Bonus|MASTER_CARD/)
      expect(kept).toMatchObject({
        installment: 3,
        fraud_status: 1,
        item_transactions: [
          expect.objectContaining({ paid: 12000 }),
          expect.objectContaining({ paid: 9000 }),
        ],
      })
    })

    it("sends a refused card back to the failure address, the cart still open", async () => {
      const cartId = await readyCart(getContainer(), shop, variantId)
      const started = await startIyzicoPayment(http, storefront.headers, cartId)
      fake.pay(started.token, { status: "FAILURE" })

      const back = await postIyzicoCallback(
        base(),
        started.sessionId,
        started.token,
        account.secretKey
      )

      expect(back.headers.get("location")).toBe(storeReturnUrls().failure)
      expect(await orderOfCart(getContainer(), cartId)).toBeNull()
    })

    it("holds a payment iyzico's fraud check is reviewing, and places it once approved", async () => {
      const cartId = await readyCart(getContainer(), shop, variantId)
      const started = await startIyzicoPayment(http, storefront.headers, cartId)
      const form = fake.pay(started.token, { fraudStatus: 0 })

      const back = await postIyzicoCallback(
        base(),
        started.sessionId,
        started.token,
        account.secretKey
      )
      const held = await orderOfCart(getContainer(), cartId)
      if (form.result) {
        form.result.fraudStatus = 1
      }
      const placed = await reconcileIyzicoSessions(getContainer(), { quietMs: 0 })

      expect(back.headers.get("location")).toBe(
        `${storeReturnUrls().success}?payment_status=review`
      )
      expect(held).toBeNull()
      expect(placed).toBe(1)
      expect(await orderOfCart(getContainer(), cartId)).toMatch(/^order_/)
    })

    it("refuses a token not the session's, a session not ours, an address we did not sign", async () => {
      const cartId = await readyCart(getContainer(), shop, variantId)
      const started = await startIyzicoPayment(http, storefront.headers, cartId)
      fake.pay(started.token)

      const wrongToken = await postIyzicoCallback(
        base(),
        started.sessionId,
        "a".repeat(36),
        account.secretKey
      )
      const badSession = await postIyzicoCallback(
        base(),
        "cart_123",
        started.token,
        account.secretKey
      )
      const asked = fake.requests.length
      // Signed with a key other than the shop's: refused before any lookup or call to iyzico
      const unsigned = await postIyzicoCallback(
        base(),
        started.sessionId,
        started.token,
        "x".repeat(20)
      )

      expect(wrongToken.status).toBe(400)
      expect(badSession.status).toBe(400)
      expect(unsigned.status).toBe(400)
      expect(fake.requests).toHaveLength(asked)
      expect(await orderOfCart(getContainer(), cartId)).toBeNull()
    })

    it("records a paid form whose session was replaced, to be given back", async () => {
      const cartId = await readyCart(getContainer(), shop, variantId)
      const first = await startIyzicoPayment(http, storefront.headers, cartId)
      // Starting again replaces the session; the first form stays payable at iyzico
      await startIyzicoPayment(http, storefront.headers, cartId)
      fake.pay(first.token)

      const back = await postIyzicoCallback(base(), first.sessionId, first.token, account.secretKey)
      const recoveries = await recoveriesOf()

      expect(back.headers.get("location")).toBe(
        `${parseEnv().STORE_CORS.split(",")[0]?.trim() ?? ""}/`
      )
      expect(recoveries).toEqual([
        expect.objectContaining({
          // iyzico's payment id, from its signed answer
          reference: fake.forms.get(first.token)?.result?.paymentId,
          reason: "session_gone",
          amount: 21000,
          status: "pending",
        }),
      ])
      expect(await orderOfCart(getContainer(), cartId)).toBeNull()
    })

    it("finds a paid form whose session was replaced even when the shopper never returns", async () => {
      const cartId = await readyCart(getContainer(), shop, variantId)
      const first = await startIyzicoPayment(http, storefront.headers, cartId)
      const second = await startIyzicoPayment(http, storefront.headers, cartId)
      fake.pay(first.token)
      fake.pay(second.token)

      await reconcileIyzicoSessions(getContainer(), { quietMs: 0 })
      const forms = await getContainer()
        .resolve<PaymentFormsModuleService>(PAYMENT_FORMS_MODULE)
        .listPaymentForms({ cart_id: cartId }, { order: { created_at: "ASC" } })

      // The live one became the order; the replaced one is to be given back
      expect(await orderOfCart(getContainer(), cartId)).toMatch(/^order_/)
      expect(await recoveriesOf()).toEqual([
        expect.objectContaining({ reason: "session_gone", amount: 21000 }),
      ])
      expect(forms.map(({ status, outcome }) => [status, outcome])).toEqual([
        ["closed", "orphan"],
        ["closed", "paid"],
      ])
    })

    it("never makes a payment recorded to be given back an order, whatever comes later", async () => {
      const cartId = await readyCart(getContainer(), shop, variantId)
      const started = await startIyzicoPayment(http, storefront.headers, cartId)
      const form = fake.pay(started.token)
      // As if completing had failed for good earlier (stock gone), now restocked
      await getContainer()
        .resolve<PaymentRecoveryModuleService>(PAYMENT_RECOVERY_MODULE)
        .recordOrphan({
          provider: "iyzico",
          reference: form.result?.paymentId ?? "",
          reason: "completion_failed",
          amount: 21000,
          currency_code: "try",
          test_mode: true,
          cart_id: cartId,
        })

      const back = await postIyzicoCallback(
        base(),
        started.sessionId,
        started.token,
        account.secretKey
      )
      await reconcileIyzicoSessions(getContainer(), { quietMs: 0 })

      expect(back.headers.get("location")).toBe(
        `${storeReturnUrls().success}?payment_status=refund`
      )
      expect(await orderOfCart(getContainer(), cartId)).toBeNull()
      expect(await recoveriesOf()).toHaveLength(1)
    })
  },
})
