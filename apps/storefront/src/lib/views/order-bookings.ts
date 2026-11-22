import { formatLira } from "@qticaret/ui"
import type { OrderBookingView, Translate } from "@qticaret/ui"
import type { OrderDeparturesRow } from "../orders/bookings"
import { departureLabel } from "./booking"

/** The backend's refusals of a shopper's departure cancel the page says in its own words. */
const REFUSALS: ReadonlySet<string> = new Set([
  "booking.cancel_too_late",
  "booking.cancel_unavailable",
  "booking.cancel_unpaid",
  "orders.cancel_contact_shop",
])

/**
 * A dated order's departures on its page (adr/0076 Ek D7a): when and
 * what, and what cancelling now gives back as the backend worked it out;
 * null for an order without any (the page drawn as before).
 */
export function orderBookingsOf(
  found: OrderDeparturesRow | null,
  t: Translate
): OrderBookingView[] | null {
  if (!found || found.departures.length === 0) {
    return null
  }
  return found.departures.map((row) => {
    const fee = row.fee_percent ?? 0
    const amount = formatLira(row.refund)
    return {
      slotId: row.slot_id,
      departure: departureLabel(row.starts_at, row.timezone),
      titles: row.titles.join(", "),
      cancelled: row.cancelled,
      cancellable: row.cancellable,
      refund: row.cancellable
        ? fee > 0
          ? t("order.booking_refund_fee", { amount, percent: fee })
          : t("order.booking_refund_full", { amount })
        : null,
      refundNote:
        row.cancellable && row.refund_within_days !== null
          ? t("order.booking_refund_within", { days: row.refund_within_days })
          : null,
      note:
        row.cancelled || row.cancellable || row.refusal === null
          ? null
          : t(REFUSALS.has(row.refusal) ? row.refusal : "order.booking_cancel_unavailable"),
    }
  })
}
