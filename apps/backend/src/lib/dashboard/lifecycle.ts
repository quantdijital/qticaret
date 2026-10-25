import type { OrderDetailDTO } from "@medusajs/framework/types"
import { getLastFulfillmentStatus, getLastPaymentStatus } from "@medusajs/medusa/core-flows"

/**
 * Where an order stands for the shop, in five words the panel shows
 * (docs/06 sözlük): waiting for payment, to be shipped, in transit,
 * delivered, canceled. Payment and shipment states are worked out the way
 * Medusa's own order list does; only these fields need reading.
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
  "fulfillments.packed_at",
  "fulfillments.shipped_at",
  "fulfillments.delivered_at",
  "fulfillments.canceled_at",
]

type When = string | Date | null | undefined

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
  fulfillments?:
    | ({ packed_at?: When; shipped_at?: When; delivered_at?: When; canceled_at?: When } | null)[]
    | null
}

// Payment taken or held: the order is the shop's to send
const PAID = new Set(["captured", "partially_captured", "authorized", "partially_authorized"])
const IN_TRANSIT = new Set(["shipped", "partially_shipped", "partially_delivered"])

export function paymentStatusOf(order: LifecycleOrder): string {
  return getLastPaymentStatus({
    currency_code: order.currency_code,
    payment_collections: (order.payment_collections ?? []).filter(Boolean),
  } as unknown as OrderDetailDTO)
}

export function fulfillmentStatusOf(order: LifecycleOrder): string {
  return getLastFulfillmentStatus({
    items: [],
    fulfillments: (order.fulfillments ?? []).filter(Boolean),
  } as unknown as OrderDetailDTO)
}

export function lifecycleOf(order: LifecycleOrder): Lifecycle {
  if (order.status === "canceled") {
    return "canceled"
  }
  const shipment = fulfillmentStatusOf(order)
  if (shipment === "delivered") {
    return "delivered"
  }
  if (IN_TRANSIT.has(shipment)) {
    return "shipped"
  }
  return PAID.has(paymentStatusOf(order)) ? "to_ship" : "awaiting_payment"
}
