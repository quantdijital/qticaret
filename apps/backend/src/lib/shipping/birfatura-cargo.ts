import { isCleanText } from "../security/text"

/**
 * BirFatura's `orderCargoUpdate` when its cargo module manages the shop's
 * parcels (adr/0072 Ek 2026-11-26): what it wrote back, read as the panel's
 * "Kargoya ver" reads a tracking typed by hand, and what to do with it.
 */

/** The shop's own parcel's tracking, as `shipOrderWorkflow` takes it. */
export interface CargoTracking {
  /** BirFatura's carrier name; empty when it sent none we can show. */
  carrier: string
  number: string
  url: string | null
}

/** The number as the panel accepts one: letters, digits and dashes, 4–40, spaces taken out. */
const NUMBER = /^[A-Za-z0-9-]{4,40}$/
const URL_SHAPE = /^https:\/\/[^\s"'<>\\]+$/

/**
 * The tracking in BirFatura's words; null when the number is not one a
 * carrier gives (refused, never stored). A link that is not https, and a
 * carrier name with control characters or past 60 characters, are left
 * out: the parcel still goes (warn, don't block).
 */
export function readCargoTracking(body: {
  cargoTrackingCode: string
  cargoTrackingCodeUrl?: string | null | undefined
  cargoCompany?: string | null | undefined
}): CargoTracking | null {
  const number = body.cargoTrackingCode.replace(/\s+/g, "")
  if (!NUMBER.test(number)) {
    return null
  }
  const url = body.cargoTrackingCodeUrl?.trim() ?? ""
  const carrier = body.cargoCompany?.trim() ?? ""
  return {
    carrier: carrier.length <= 60 && isCleanText(carrier) ? carrier : "",
    number,
    url: url.length <= 500 && URL_SHAPE.test(url) ? url : null,
  }
}

/** What the decision reads of the order. */
export interface CargoOrderFacts {
  id: string
  status?: string | null
  canceled_at?: string | Date | null
  fulfillments?:
    | ({
        canceled_at?: string | Date | null
        labels?: ({ tracking_number?: string | null } | null)[] | null
      } | null)[]
    | null
}

export type CargoRefusal = "unknown_order" | "exchange" | "canceled" | "tracking_invalid"

export type CargoDecision =
  | { action: "ship"; order_id: string }
  | { action: "already"; order_id: string }
  | { action: "refuse"; reason: CargoRefusal; order_id: string | null }

const sameNumber = (a: string | null | undefined, b: string): boolean =>
  (a ?? "").replace(/\s+/g, "").toUpperCase() === b.toUpperCase()

/**
 * What a tracking number BirFatura wrote back does to the order:
 * - an id we never gave, an order it never pulled from us, or none at all:
 *   refused (`unknown_order`);
 * - an exchange's sale (its own `OrderId`, adr/0072 §5): refused, its
 *   parcel is handed over from the panel (`exchange`);
 * - a canceled order: refused;
 * - the same number on a parcel of the order already: nothing to do, the
 *   same answer again (a replay sends no second e-mail);
 * - otherwise the order ships whole (all that is left) with this number.
 */
export function decideCargo(facts: {
  order: CargoOrderFacts | null
  exchange: boolean
  /** BirFatura pulled this order's sale invoice from us (`listed_at`). */
  pulled: boolean
  tracking: CargoTracking | null
}): CargoDecision {
  const { order } = facts
  if (facts.exchange) {
    return { action: "refuse", reason: "exchange", order_id: order?.id ?? null }
  }
  if (!order || !facts.pulled) {
    return { action: "refuse", reason: "unknown_order", order_id: null }
  }
  if (!facts.tracking) {
    return { action: "refuse", reason: "tracking_invalid", order_id: order.id }
  }
  const tracking = facts.tracking
  const known = (order.fulfillments ?? []).some(
    (parcel) =>
      parcel !== null &&
      !parcel.canceled_at &&
      (parcel.labels ?? []).some((label) => sameNumber(label?.tracking_number, tracking.number))
  )
  if (known) {
    return { action: "already", order_id: order.id }
  }
  if (order.status === "canceled" || order.canceled_at) {
    return { action: "refuse", reason: "canceled", order_id: order.id }
  }
  return { action: "ship", order_id: order.id }
}
