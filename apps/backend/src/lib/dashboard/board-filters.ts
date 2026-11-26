import type { ShipmentStatus } from "../../modules/shipment-tracking/states"
import type { Lifecycle, LifecycleOrder } from "./lifecycle"
import { paymentStatusOf } from "./lifecycle"

/**
 * The order list's filters beside its stage tabs (F12.3): where the money
 * stands and where the parcel stands, each on its own. The stage says
 * what the shop does next; these answer "which orders are refunded" or
 * "which parcels are stuck".
 */

export const PAYMENT_FILTERS = ["paid", "awaiting", "refunded"] as const
export type PaymentFilter = (typeof PAYMENT_FILTERS)[number]

export const SHIPPING_FILTERS = ["none", "label", "on_the_way", "delivered", "problem"] as const
export type ShippingFilter = (typeof SHIPPING_FILTERS)[number]

/**
 * Who carries the order, by the delivery the shopper chose: a carrier that
 * issues labels, or `own` for the shop's own delivery and collection.
 */
export const CARRIER_FILTERS = ["aras", "yurtici", "dhlecommerce", "own"] as const
export type CarrierFilter = (typeof CARRIER_FILTERS)[number]

// Medusa's payment states (getLastPaymentStatus), each in one group; any other is awaited
const PAYMENT_GROUP: Readonly<Record<string, PaymentFilter>> = {
  captured: "paid",
  partially_captured: "paid",
  authorized: "paid",
  partially_authorized: "paid",
  refunded: "refunded",
  partially_refunded: "refunded",
}

/** Where the order's money stands: taken (or held), given back (in part), or not yet. */
export function paymentFilterOf(order: LifecycleOrder): PaymentFilter {
  return PAYMENT_GROUP[paymentStatusOf(order)] ?? "awaiting"
}

const PARCEL_GROUP: Readonly<Record<ShipmentStatus, ShippingFilter | null>> = {
  created: "label",
  picked_up: "on_the_way",
  in_transit: "on_the_way",
  out_for_delivery: "on_the_way",
  delivered: "delivered",
  returned: "problem",
  failed: "problem",
  // A withdrawn parcel says nothing: the order's own state does
  canceled: null,
}

/**
 * Where the order's parcel stands: its carrier's word when a carrier has
 * it, else the order's own (the shop's delivery, a collection).
 */
export function shippingFilterOf(
  lifecycle: Lifecycle,
  parcel: ShipmentStatus | null
): ShippingFilter {
  const byCarrier = parcel ? PARCEL_GROUP[parcel] : null
  if (byCarrier) {
    return byCarrier
  }
  return lifecycle === "delivered" ? "delivered" : lifecycle === "shipped" ? "on_the_way" : "none"
}

/**
 * Whether a value is one of a filter's choices (an order paid or refunded);
 * no choices, the filter not set, keeps every value.
 */
export function oneOf(choices: readonly string[] | undefined, value: string): boolean {
  return !choices || choices.length === 0 || choices.includes(value)
}
