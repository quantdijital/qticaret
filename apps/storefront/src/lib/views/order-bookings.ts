import { formatLira } from "@qticaret/ui"
import type { OrderBookingView, Translate } from "@qticaret/ui"
import type { CancelContactRow, OrderDeparturesRow } from "../orders/bookings"
import { departureLabel } from "./booking"
import { displayPhone } from "./frame"

/** The backend's refusals of a shopper's departure cancel the page says in its own words. */
const REFUSALS: ReadonlySet<string> = new Set([
  "booking.cancel_too_late",
  "booking.cancel_unavailable",
  "booking.cancel_unpaid",
  "orders.cancel_contact_shop",
])

const BY_CONTACT = "booking.cancel_by_contact"

/** The shop's note (or the default) and how to reach it, as one sentence run. */
function contactNote(contact: CancelContactRow | undefined, t: Translate): string {
  return [
    contact?.note ?? t(BY_CONTACT),
    contact?.phone ? t("booking.contact_phone", { phone: displayPhone(contact.phone) }) : null,
    contact?.email ? t("booking.contact_email", { email: contact.email }) : null,
  ]
    .filter(Boolean)
    .join(" ")
}

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
          : row.refusal === BY_CONTACT
            ? contactNote(found.contact, t)
            : t(REFUSALS.has(row.refusal) ? row.refusal : "order.booking_cancel_unavailable"),
    }
  })
}
