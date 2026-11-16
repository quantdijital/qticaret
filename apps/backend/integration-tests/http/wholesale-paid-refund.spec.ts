import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { fakePaytrAccount, startFakePaytr } from "@qticaret/testing"
import type { FakePaytr } from "@qticaret/testing"
import paymentRecovery from "../../src/jobs/payment-recovery"
import { PAYMENT_RECOVERY_MODULE } from "../../src/modules/payment-recovery"
import type PaymentRecoveryModuleService from "../../src/modules/payment-recovery/service"
import { registerCustomer } from "../helpers/customer"
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
import { accountApi, tierRecords, wholesaleApi } from "../helpers/wholesale"
import { leaveGroup, readyShopperCart } from "../helpers/wholesale-checkout"
import { outcome, plain } from "../helpers/wholesale-store"

jest.setTimeout(240 * 1000)

// A made-up PayTR account, fresh per run; the fake server checks every signature with it
const account = fakePaytrAccount()

/**
 * Slice 4 review Y1 and N1, end to end: a card payment taken for a cart
 * the completion's own rules then refuse (a wholesale cart no longer at
 * its customer's prices; add-ons switched off) opens no order, is
 * recorded for refund and given back once, never tried again for ever.
 */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    let fake: FakePaytr
    let shop: StockShop
    let store: Storefront
    let admin: { headers: Record<string, string> }

    const recoveries = () =>
      getContainer()
        .resolve<PaymentRecoveryModuleService>(PAYMENT_RECOVERY_MODULE)
        .listPaymentRecoveries({ provider: "paytr" })
    /** PayTR marks a payment notified once the shop answered "OK"; the test posts it itself. */
    const acknowledged = (merchantOid: string) => {
      const payment = fake.payments.get(merchantOid)
      if (payment) {
        payment.notified = true
      }
    }
    const feature = (key: string, enabled: boolean) =>
      plain(http.post(`/admin/features/${key}`, { enabled }, { headers: admin.headers }))

    /** The card payment notified, the refund job run; what the shop is left with. */
    async function paidThenRefused(cartId: string, reference: string) {
      const notification = fake.pay(reference)
      const answer = await notifyPaytr(http, notification)
      acknowledged(reference)
      // PayTR sends it again: the refusal is the same, nothing recorded twice
      const again = await notifyPaytr(http, notification)
      await paymentRecovery(getContainer())
      expect([answer.data, again.data]).toEqual(["OK", "OK"])
      expect(await orderOfCart(getContainer(), cartId)).toBeNull()
      expect(await recoveries()).toEqual([
        expect.objectContaining({
          reason: "completion_failed",
          status: "refunded",
          cart_id: cartId,
        }),
      ])
      const paid = fake.payments.get(reference)
      expect(paid?.refunds).toEqual([{ amount: paid?.paymentAmount, referenceNo: `R${reference}` }])
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
      store = await createStorefront(container)
      admin = await connectPaytr(http, container, account)
    })
    // Flags live in settings, whose cache outlives the database reset between tests
    afterEach(async () => {
      await feature("catalog.addons", false)
      await feature("customers.wholesale", false)
    })

    it("refunds a wholesale cart paid by card after it left its customer's prices", async () => {
      expect((await feature("customers.wholesale", true)).status).toBe(200)
      const staff = wholesaleApi(http, admin.headers)
      const product = await stockedProduct(getContainer(), shop, "kart-toptan", 50, 100)
      const tier = await staff.tier({ name: "Toptan kart" })
      const set = await staff.prices(tier.id, {
        set: [{ variant_id: product.variantId, net: "66.67" }],
      })
      expect(outcome(set, 200)).toEqual({ status: 200, data: null })
      const customer = await registerCustomer(http, store)
      await accountApi(http, admin.headers).made({
        email: customer.email,
        contact_name: "Ali Kaya",
        tier_id: tier.id,
      })
      const cartId = await readyShopperCart(
        http,
        getContainer(),
        shop,
        customer.headers,
        product.variantId
      )
      const reference = await startPaytrPayment(http, customer.headers, cartId)
      // Out of the level after the card form opened, the cart left at 80.00 (review M1)
      const { groupId } = await tierRecords(getContainer(), tier.id)
      await leaveGroup(getContainer(), groupId, customer.id)

      await paidThenRefused(cartId, reference)
    })

    it("refunds a cart paid by card after the shop switched its add-ons off", async () => {
      expect((await feature("catalog.addons", true)).status).toBe(200)
      const product = await stockedProduct(getContainer(), shop, "kart-ek", 50, 1000)
      const saved = await plain(
        http.post<{ addons?: { id: string; choices?: { id: string }[] }[] }>(
          `/admin/products/${product.productId}/catalog`,
          {
            addons: [
              { kind: "choice", label: "Kılıf", choices: [{ label: "Desenli Siyah", price: 300 }] },
            ],
          },
          { headers: admin.headers }
        )
      )
      const addon = saved.data.addons?.[0]
      const cartId = await readyCart(getContainer(), shop, product.variantId)
      const { data } = await getContainer()
        .resolve(ContainerRegistrationKeys.QUERY)
        .graph({ entity: "cart", fields: ["items.id"], filters: { id: cartId } })
      const lineId = (data[0] as { items: { id: string }[] }).items[0]?.id ?? ""
      const picked = await plain(
        http.post(
          `/store/carts/${cartId}/line-items/${lineId}/addons`,
          { selections: [{ addon_id: addon?.id, choice_id: addon?.choices?.[0]?.id }] },
          { headers: store.headers }
        )
      )
      expect(outcome(picked, 200)).toEqual({ status: 200, data: null })
      const reference = await startPaytrPayment(http, store.headers, cartId)
      // The completion refuses the picked line now (catalog.addons_disabled)
      expect((await feature("catalog.addons", false)).status).toBe(200)

      await paidThenRefused(cartId, reference)
    })
  },
})
