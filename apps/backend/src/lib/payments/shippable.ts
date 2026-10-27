import { paidInTestMode } from "./test-mode"

/** What a shipping check reads of an order: its collections' status and payments' data. */
export const SHIPPING_PAYMENT_FIELDS = [
  "payment_collections.status",
  "payment_collections.payments.data",
]

interface ShippingOrder {
  payment_collections?:
    ({ status?: string | null; payments?: ({ data?: unknown } | null)[] | null } | null)[] | null
}

/**
 * Why an order may not be shipped yet, or null (adr/0027, adr/0029): paid
 * in a provider's test mode (no real money), or its payment still awaited
 * (a bank transfer not yet confirmed). Cash on delivery is shipped unpaid.
 */
export function shippingBlock(order: ShippingOrder | null | undefined): string | null {
  if (paidInTestMode(order)) {
    return "orders.test_payment_not_shippable"
  }
  const awaited = (order?.payment_collections ?? []).some(
    (collection) => collection?.status === "awaiting"
  )
  return awaited ? "orders.payment_awaited" : null
}
