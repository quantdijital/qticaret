import { kurus } from "../money"
import type { Kurus } from "../money"

/**
 * A dated line's record (adr/0076 §5), written only by the server's
 * booking route (`qt_` is refused from a storefront): the cart's hold it
 * was taken under, its departure, when that starts (for the cart's and the
 * order's display) and the places one unit takes. No personal data.
 */
export const BOOKING_KEY = "qt_booking"

export interface BookingMark {
  hold_id: string
  slot_id: string
  starts_at: string
  pax: number
}

// How long a payment's start keeps the cart's places (a 3-D Secure or a
// hosted form's return; the hold's own 120-minute lifetime still caps it)
export const PAYMENT_HOLD_MINUTES = 30
// What the completion leaves the hold for the order's confirmation to find it
export const COMPLETION_HOLD_MINUTES = 15
// The departures one product page lists ahead
export const STORE_SLOTS_LIMIT = 100

const HOUR = 60 * 60 * 1000

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value)

/** The line's booking record, or null on any other line (or a malformed one). */
export function bookingMarkOf(metadata: unknown): BookingMark | null {
  const mark = isRecord(metadata) ? metadata[BOOKING_KEY] : undefined
  if (!isRecord(mark)) {
    return null
  }
  const { hold_id: holdId, slot_id: slotId, starts_at: startsAt, pax } = mark
  if (
    typeof holdId !== "string" ||
    typeof slotId !== "string" ||
    typeof startsAt !== "string" ||
    typeof pax !== "number" ||
    !Number.isInteger(pax) ||
    pax < 0
  ) {
    return null
  }
  return { hold_id: holdId, slot_id: slotId, starts_at: startsAt, pax }
}

/** Places one unit of the variant takes (`pax_by_variant`); a variant left out takes one. */
export function paxOf(paxByVariant: unknown, variantId: string): number {
  const entry = isRecord(paxByVariant) ? paxByVariant[variantId] : undefined
  const pax = isRecord(entry) ? entry["pax"] : undefined
  return typeof pax === "number" && Number.isInteger(pax) && pax >= 0 ? pax : 1
}

/** A departure's places for these units: Σ quantity × pax (an infant counts none). */
export function unitsOf(
  items: readonly { variant_id: string; quantity: number }[],
  paxByVariant: unknown
): number {
  return items.reduce((sum, item) => sum + item.quantity * paxOf(paxByVariant, item.variant_id), 0)
}

/** Sales close `cutoffHours` before the departure; at or past that moment nothing is sold. */
export function salesClosed(startsAt: Date, cutoffHours: number, now: Date = new Date()): boolean {
  return now.getTime() >= startsAt.getTime() - cutoffHours * HOUR
}

/**
 * Why a departure's difference cannot be priced in this currency, or
 * null. Differences are kept in Turkish kuruş (the panel enters lira): a
 * cart in another currency takes no difference, and one that would need
 * one is refused rather than sold at the wrong price.
 */
export function adjustmentProblem(currencyCode: string, adjustment: number): string | null {
  return adjustment !== 0 && currencyCode.toLowerCase() !== "try"
    ? "booking.currency_unsupported"
    : null
}

/** The departure's difference for a variant, in kuruş (0 when it has none). */
export function adjustmentOf(
  adjustments: Record<string, number> | null,
  variantId: string
): number {
  const value = adjustments?.[variantId]
  return typeof value === "number" && Number.isFinite(value) ? Math.round(value) : 0
}

/**
 * A dated line's unit price: the variant's price in the cart's pricing
 * context plus the departure's difference, never below zero (a discount
 * larger than the price gives the place away, it never pays the buyer).
 */
export function bookingUnitPrice(base: Kurus, adjustment: number): Kurus {
  return kurus(Math.max(0, base + adjustment))
}
