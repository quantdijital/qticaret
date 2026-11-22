import type { OrderDetailDTO } from "@medusajs/framework/types"
import { MathBN } from "@medusajs/framework/utils"
import { getLastPaymentStatus } from "@medusajs/medusa/core-flows"
import { bookingMarkOf } from "../booking/cart-lines"

/**
 * Where an order stands for the shop, in six words the panel shows
 * (docs/06 sözlük): waiting for payment, to be shipped, in transit,
 * planned (a dated line ahead, adr/0076 §8), delivered, canceled.
 * Payment follows Medusa's own order list; the parcel side is read from each item's fulfilled, shipped and delivered counts, so
 * an order with something left to send stays "to ship" after its first
 * parcel leaves. Lines that need no shipping (digital, service; F3.2) are
 * done once paid. The list, the dashboard and the order page all use this.
 */

export const LIFECYCLES = [
  "awaiting_payment",
  "to_ship",
  "shipped",
  "planned",
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
  "items.requires_shipping",
  // A dated line's record (adr/0076 §8): its service date makes a paid order "planned"
  "items.metadata",
  "items.detail.quantity",
  "items.detail.fulfilled_quantity",
  "items.detail.shipped_quantity",
  "items.detail.delivered_quantity",
]

export interface LifecycleItem {
  quantity?: number | null
  /** False for a digital or service line (F3.2); missing reads as true. */
  requires_shipping?: boolean | null
  /** A dated line carries its departure's start here (`qt_booking`, adr/0076 §5). */
  metadata?: unknown
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

type BNInput = Parameters<typeof MathBN.convert>[0]
const amountOf = (value: unknown) => MathBN.convert((value ?? 0) as BNInput)

/** Money was taken and all of it went back. */
function allGivenBack(order: LifecycleOrder): boolean {
  const rows = (order.payment_collections ?? []).filter(Boolean)
  const taken = rows.reduce(
    (sum, row) => MathBN.add(sum, amountOf(row?.captured_amount)),
    MathBN.convert(0)
  )
  const back = rows.reduce(
    (sum, row) => MathBN.add(sum, amountOf(row?.refunded_amount)),
    MathBN.convert(0)
  )
  return MathBN.gt(taken, 0) && MathBN.gte(back, taken)
}

const presentItems = (order: LifecycleOrder): LifecycleItem[] =>
  (order.items ?? []).filter((item): item is LifecycleItem => item !== null)

// The lines that travel in a parcel; the others are done once paid
export const shippableItems = <T extends LifecycleItem>(
  items: (T | null)[] | null | undefined
): T[] =>
  (items ?? []).filter((item): item is T => item !== null && item.requires_shipping !== false)

const counts = (item: LifecycleItem) => ({
  quantity: item.quantity ?? 0,
  fulfilled: item.detail?.fulfilled_quantity ?? 0,
  shipped: item.detail?.shipped_quantity ?? 0,
  delivered: item.detail?.delivered_quantity ?? 0,
})

/** Something not yet in a parcel, or packed and not yet handed over. */
export function hasSomethingToShip(order: LifecycleOrder): boolean {
  return shippableItems(order.items).some((item) => {
    const { quantity, fulfilled, shipped } = counts(item)
    return fulfilled < quantity || shipped < fulfilled
  })
}

/**
 * The latest service date of the order's dated lines (adr/0076 §8), as
 * their records give it; null without one. A departure moved by staff
 * after the order keeps the date the line was sold for.
 */
export function serviceDateOf(order: LifecycleOrder): Date | null {
  let latest: number | null = null
  for (const item of presentItems(order)) {
    const mark = bookingMarkOf(item.metadata)
    const at = mark ? Date.parse(mark.starts_at) : Number.NaN
    if (!Number.isNaN(at) && (latest === null || at > latest)) {
      latest = at
    }
  }
  return latest === null ? null : new Date(latest)
}

/**
 * Where the order stands. A paid order whose parcels are all done (or
 * that has none) and holds a dated line is "planned" until its service
 * date, then done ("delivered", shown as completed); a dated-only order
 * whose money all went back (its bookings cancelled) reads as canceled.
 * Without dated lines nothing changed. `now` is ignored unless a Date
 * (a caller mapping over orders passes an index).
 */
export function lifecycleOf(order: LifecycleOrder, now?: unknown): Lifecycle {
  const stage = parcelStageOf(order)
  if (stage !== "delivered" && stage !== "awaiting_payment") {
    return stage
  }
  const serviceDate = serviceDateOf(order)
  if (serviceDate === null) {
    return stage
  }
  const datedOnly = presentItems(order).every((item) => bookingMarkOf(item.metadata) !== null)
  if (datedOnly && allGivenBack(order)) {
    return "canceled"
  }
  const at = now instanceof Date ? now : new Date()
  return stage === "delivered" && serviceDate.getTime() > at.getTime() ? "planned" : stage
}

function parcelStageOf(order: LifecycleOrder): Lifecycle {
  if (order.status === "canceled") {
    return "canceled"
  }
  if (presentItems(order).length > 0 && shippableItems(order.items).length === 0) {
    return isPaid(order) ? "delivered" : "awaiting_payment"
  }
  const items = shippableItems(order.items).map(counts)
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
