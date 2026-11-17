import type { MedusaContainer } from "@medusajs/framework/types"
import { fakeIyzicoAccount, startFakeIyzico } from "@qticaret/testing"
import type { FakeIyzico } from "@qticaret/testing"
import { ORDER_REFUNDS_MODULE } from "../../src/modules/order-refunds"
import type OrderRefundsModuleService from "../../src/modules/order-refunds/service"
import type { HttpClient } from "./http"
import { settle } from "./http"
import { connectIyzico, postIyzicoCallback, startIyzicoPayment } from "./iyzico"
import { orderOfCart, readyCart } from "./paytr"
import { defined, refundOrder } from "./refunds"
import { stockShop, stockedProduct } from "./stock"
import type { StockShop } from "./stock"
import { createStorefront } from "./storefront"
import type { Storefront } from "./storefront"
import { loadTrAddressFixture } from "./tr-address"

export const IYZICO_REFUND = "/payment/refund"

/** iyzico's own `failure` answer with this code. */
export const iyzicoFailure = (errorCode: string) => ({
  body: { status: "failure", errorCode, errorMessage: "x", locale: "tr", systemTime: 0 },
})

/**
 * An iyzico shop for the order refund suites (D4-1): the fake server, a
 * cup at 120 TL, a storefront and the owner who connected the account; set
 * up and torn down by the suite's own hooks. Two cups and shipping are
 * 330 TL: item transaction `01` holds 240, `02` (shipping) 90.
 */
export function iyzicoRefundShop(api: unknown, getContainer: () => MedusaContainer) {
  const http = api as HttpClient
  const base = () => (api as { defaults: { baseURL?: string } }).defaults.baseURL ?? ""
  const account = fakeIyzicoAccount()
  let fake: FakeIyzico
  let shop: StockShop
  let storefront: Storefront
  let variantId: string
  let admin: { headers: Record<string, string> }

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

  const ledger = () => getContainer().resolve<OrderRefundsModuleService>(ORDER_REFUNDS_MODULE)

  return {
    http,
    fake: () => fake,
    admin: () => admin,
    ledger,
    /** Two cups and shipping, paid: the order and iyzico's payment id. */
    paidOrder: async () => {
      const cartId = await readyCart(getContainer(), shop, variantId, undefined, 2)
      const started = await startIyzicoPayment(http, storefront.headers, cartId)
      const form = fake.pay(started.token)
      await postIyzicoCallback(base(), started.sessionId, started.token, account.secretKey)
      return {
        orderId: (await orderOfCart(getContainer(), cartId)) ?? "",
        paymentId: form.result?.paymentId ?? "",
      }
    },
    refund: (orderId: string, body: Record<string, unknown>) =>
      refundOrder(http, admin.headers, orderId, body),
    /** The staff check of an open refund. */
    check: (
      orderId: string,
      reference: string,
      body: Record<string, unknown>,
      headers: Record<string, string> = admin.headers
    ) =>
      settle(
        http.post<{ refund?: { status: string }; message?: string }>(
          `/admin/orders/${orderId}/refunds/${reference}/settle`,
          body,
          { headers }
        )
      ),
    entryOf: async (reference: string) =>
      defined((await ledger().listOrderRefunds({ reference }))[0], "ledger entry"),
    /** The refund requests iyzico got under a reference. */
    sentFor: (reference: string) =>
      fake.requests.filter(
        ({ path, body }) => path === IYZICO_REFUND && body["conversationId"] === reference
      ).length,
    /** The cups' part (240) answered, the shipping's then answered as `second`. */
    halfway: (second: Parameters<FakeIyzico["queue"]>[1]) => {
      fake.queue(IYZICO_REFUND, { pass: true })
      fake.queue(IYZICO_REFUND, second)
    },
  }
}
