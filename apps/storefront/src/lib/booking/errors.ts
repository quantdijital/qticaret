import { linkCartRefusal } from "../cart/payment-link"
import { isStoreApiError } from "../store-api/errors"

/**
 * The booking route's refusals a shopper can act on (adr/0076 Ek D2, D3,
 * takip), each worded in `tr.json` and shown as they come. A backend key
 * the shopper can do nothing with reads as the fallback.
 */
export const BOOKING_ERROR_KEYS: ReadonlySet<string> = new Set([
  "booking.slot_full",
  "booking.slot_closed",
  "booking.sales_closed",
  "booking.slot_unknown",
  "booking.max_units",
  "booking.client_share",
  "booking.quantity_too_high",
  "booking.too_many_free_units",
  "booking.units_invalid",
  "booking.variant_unknown",
  "booking.currency_unsupported",
  "booking.price_unavailable",
  "booking.hold_expired",
])

// Said as "dated sales are not taken now": the shop turned them off, or the product is no longer dated
const UNAVAILABLE = new Set([
  "booking.unavailable",
  "booking.product_not_dated",
  "catalog.booking_disabled",
  "catalog.product_unknown",
])

/** A key from the backend (or the storefront's `BookingRefused`) in the shopper's words' key. */
export function bookingErrorKey(key: string | null): string {
  if (key !== null && BOOKING_ERROR_KEYS.has(key)) {
    return key
  }
  // A bare 404 (no key): the shop has dated sales off
  if (key === null || UNAVAILABLE.has(key)) {
    return "booking.unavailable"
  }
  return "booking.add_failed"
}

/** A failed booking in words' key: a payment link's cart, too many asks, a known refusal. */
export function bookingError(error: unknown): string {
  const link = linkCartRefusal(error)
  if (link) {
    return link
  }
  if (isStoreApiError(error)) {
    return error.status === 429 ? "errors.too_many_requests" : bookingErrorKey(error.messageKey)
  }
  if (error instanceof Error && error.name === "BookingRefused" && "key" in error) {
    return bookingErrorKey(typeof error.key === "string" ? error.key : null)
  }
  return "booking.add_failed"
}
