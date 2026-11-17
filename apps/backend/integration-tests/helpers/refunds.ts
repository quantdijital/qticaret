import type { MedusaContainer } from "@medusajs/framework/types"
import { paytrNotification } from "@qticaret/testing"
import type { FakePaytr, PaytrAccount } from "@qticaret/testing"
import type { HttpClient } from "./http"
import { settle } from "./http"
import { PAYTR_ADDRESS, notifyPaytr, orderOfCart, readyCart, startPaytrPayment } from "./paytr"
import type { StockShop } from "./stock"

/** Two cups (120 each) and shipping (90), paid with PayTR and acknowledged: 330 TL. */
export async function paidPaytrOrder(
  http: HttpClient,
  container: MedusaContainer,
  setup: {
    fake: FakePaytr
    account: PaytrAccount
    shop: StockShop
    variantId: string
    storefront: { headers: Record<string, string> }
  }
): Promise<{ orderId: string; reference: string }> {
  const { fake, account, shop, variantId, storefront } = setup
  const cartId = await readyCart(container, shop, variantId, PAYTR_ADDRESS, 2)
  const reference = await startPaytrPayment(http, storefront.headers, cartId)
  fake.pay(reference)
  await notifyPaytr(
    http,
    paytrNotification(account, {
      merchantOid: reference,
      status: "success",
      paymentAmount: 33000,
      testMode: true,
    })
  )
  // PayTR counts the payment acknowledged once the shop answered "OK"
  const payment = fake.payments.get(reference)
  if (payment) {
    payment.notified = true
  }
  return { orderId: (await orderOfCart(container, cartId)) ?? "", reference }
}

/** The panel's refund request: lines or a free amount, under its 32-hex key. */
export const refundOrder = (
  http: HttpClient,
  headers: Record<string, string>,
  orderId: string,
  body: Record<string, unknown>
) =>
  settle(
    http.post<{ refund: { amount: string; made_before: boolean }; message?: string }>(
      `/admin/orders/${orderId}/refunds`,
      body,
      { headers }
    )
  )

/**
 * Lets the ledger fail closing one entry (`done`), once: a step after the
 * provider's failing, the refund made by then (review 2026-11-17).
 */
export function failLedgerCloseOnce(ledger: {
  updateOrderRefunds: (...args: never[]) => unknown
}): { restore: () => void } {
  const update = ledger.updateOrderRefunds.bind(ledger) as (data: unknown) => Promise<unknown>
  let broken = false
  const spy = jest.spyOn(ledger, "updateOrderRefunds").mockImplementation((data: unknown) => {
    if (!broken && (data as { status?: string }).status === "done") {
      broken = true
      return Promise.reject(new Error("ledger unavailable"))
    }
    return update(data)
  })
  return {
    restore: () => {
      spy.mockRestore()
    },
  }
}
