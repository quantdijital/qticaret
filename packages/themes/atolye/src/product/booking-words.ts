import type { Translate } from "@qticaret/ui"

/**
 * A dated product's words for its client parts (adr/0076 §10; docs/19
 * §6.2: translated here, never `t` in the browser), and the booking
 * action's message keys.
 */

/** What `addBookingToCart` can come back with (the storefront's own keys). */
export const BOOKING_ERRORS = [
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
  "booking.unavailable",
  "booking.add_failed",
  "booking.choose_departure",
  "booking.choose_people",
  "cart.payment_link_locked",
  "errors.too_many_requests",
]

export const bookingWords = (t: Translate) => ({
  departures: t("booking.departures"),
  moreDepartures: t("booking.more_departures"),
  people: t("booking.people"),
  full: t("booking.full"),
  closed: t("booking.closed"),
  fewLeft: t("booking.few_left"),
  placesLeft: t("booking.places_left"),
  noSeat: t("booking.no_seat"),
  noPrice: t("booking.no_price"),
  priceBefore: t("price.before"),
  decrease: t("booking.decrease"),
  increase: t("booking.increase"),
  countOf: t("booking.count_of"),
  total: t("booking.total"),
  totalPeople: t("booking.total_people"),
  totalNote: t("booking.total_note"),
  submit: t("booking.submit"),
  adding: t("booking.adding"),
  added: t("booking.added"),
  goToCart: t("product.go_to_cart"),
  soon: t("booking.soon"),
  soonText: t("booking.soon_text"),
  errors: Object.fromEntries(BOOKING_ERRORS.map((key) => [key, t(key)])) as Record<string, string>,
  fallback: t("booking.add_failed"),
})

export type BookingWords = ReturnType<typeof bookingWords>
