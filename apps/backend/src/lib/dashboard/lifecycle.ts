import type { OrderDetailDTO } from "@medusajs/framework/types"
import { getLastPaymentStatus } from "@medusajs/medusa/core-flows"

/**
 * Where an order stands for the shop, in five words the panel shows
 * (docs/06 sözlük): waiting for payment, to be shipped, in transit,
 * delivered, canceled. Payment follows Medusa's own order list; the parcel
 * side is read from each item's fulfilled, shipped and delivered counts, so
 * an order with something left to send stays "to ship" after its first
 * parcel leaves. The list, the dashboard and the order page all use this.
 */

export const LIFECYCLES = [
  "awaiting_payment",
  "to_ship",
  "shipped",
  "delivered",
  "canceled",
] as const
export type Lifecycle = (typeof LIFECYCLES)[number]

export const LIFECYCLE_FIELDS = [
  "status",
  "currency_code",
  "payment_collections.status",
  "payment_collections.amount",
  "payment_collections.captured_amount",
  "payment_collections.refunded_amount",
  // Medusa fills an item's quantity only with its detail (or the totals) requested
  "items.quantity",
  "items.detail.quantity",
  "items.detail.fulfilled_quantity",
  "items.detail.shipped_quantity",
  "items.detail.delivered_quantity",
]

export interface LifecycleItem {
  quantity?: number | null
  detail?: {
    fulfilled_quantity?: number | null
    shipped_quantity?: number | null
    delivered_quantity?: number | null
  } | null
}

/** What a query returns for the fields above; amounts in any form Medusa reads. */
export interface LifecycleOrder {
  status: string
  currency_code: string
  payment_collections?:
    | ({
        status?: string | null
        amount?: unknown
        captured_amount?: unknown
        refunded_amount?: unknown
      } | null)[]
    | null
  items?: (LifecycleItem | null)[] | null
}

// Payment taken or held, a part given back included: the order is the shop's to send
const PAID = new Set([
  "captured",
  "partially_captured",
  "authorized",
  "partially_authorized",
  "partially_refunded",
])

export function paymentStatusOf(order: LifecycleOrder): string {
  return getLastPaymentStatus({
    currency_code: order.currency_code,
    payment_collections: (order.payment_collections ?? []).filter(Boolean),
  } as unknown as OrderDetailDTO)
}

export const isPaid = (order: LifecycleOrder): boolean => PAID.has(paymentStatusOf(order))

const presentItems = (order: LifecycleOrder): LifecycleItem[] =>
  (order.items ?? []).filter((item): item is LifecycleItem => item !== null)

const counts = (item: LifecycleItem) => ({
  quantity: item.quantity ?? 0,
  fulfilled: item.detail?.fulfilled_quantity ?? 0,
  shipped: item.detail?.shipped_quantity ?? 0,
  delivered: item.detail?.delivered_quantity ?? 0,
})

/** Something not yet in a parcel, or packed and not yet handed over. */
export function hasSomethingToShip(order: LifecycleOrder): boolean {
  return presentItems(order).some((item) => {
    const { quantity, fulfilled, shipped } = counts(item)
    return fulfilled < quantity || shipped < fulfilled
  })
}

export function lifecycleOf(order: LifecycleOrder): Lifecycle {
  if (order.status === "canceled") {
    return "canceled"
  }
  const items = presentItems(order).map(counts)
  if (
    items.length > 0 &&
    items.every((item) => item.quantity > 0 && item.delivered >= item.quantity)
  ) {
    return "delivered"
  }
  if (!hasSomethingToShip(order) && items.some((item) => item.shipped > 0)) {
    return "shipped"
  }
  return isPaid(order) ? "to_ship" : "awaiting_payment"
}
