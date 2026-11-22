import type { TFunction } from "i18next"
import { errorText } from "@/lib/errors"

const E = "products.booking.errors"

// The server's refusals the booking screens word themselves; any other as the server says it
const REFUSALS: Readonly<Record<string, string>> = {
  "catalog.booking_disabled": "disabled",
  "catalog.booking_kind": "kind",
  "catalog.booking_range_unavailable": "range",
  "booking.product_not_dated": "notDated",
  "booking.capacity_below_sold": "capacityBelowSold",
  "booking.slot_dates_invalid": "dates",
  "booking.slot_unknown": "slotUnknown",
  "booking.variant_unknown": "variantUnknown",
  "booking.price_adjustment_invalid": "priceAdjustment",
  "booking.hold_minutes_invalid": "holdMinutes",
  "booking.pax_ages_invalid": "paxAges",
  "booking.pax_invalid": "pax",
  "booking.cancellation_tiers_invalid": "tiers",
  "booking.slot_cancelled": "slotCancelled",
  "booking.use_departure_cancel": "useDepartureCancel",
}

/**
 * A refused booking save in the panel's words: the key from the body
 * (`code`) or as the sentence (a client keeping only the key); otherwise
 * the server's sentence (`errorText`).
 */
export function bookingFailureText(t: TFunction, failure: unknown): string {
  const { code, message } = (failure ?? {}) as { code?: unknown; message?: unknown }
  for (const key of [code, message]) {
    if (typeof key === "string" && key in REFUSALS) {
      return t(`${E}.${REFUSALS[key] ?? ""}`)
    }
  }
  return errorText(t, failure)
}
