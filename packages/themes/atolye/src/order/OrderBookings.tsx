import type { OrderActions, OrderBookingView, OrderPageView, Translate } from "@qticaret/ui"

const WELL = "flex flex-col gap-4 rounded-tile gf-pane p-5 sm:p-7"

/** A departure's cancel: what comes back first, then the confirming button (adr/0076 Ek D7a). */
function CancelAsk({
  view,
  booking,
  t,
  action,
}: {
  view: OrderPageView
  booking: OrderBookingView
  t: Translate
  action: NonNullable<OrderActions["cancelBooking"]>
}) {
  return (
    <details className="group">
      <summary className="gf-btn gf-btn--quiet cursor-pointer self-start text-error group-open:hidden">
        {t("order.booking_cancel_ask")}
      </summary>
      <form action={action} className="flex flex-col gap-3 rounded-media gf-pane-inner p-4">
        <input type="hidden" name="order_id" value={view.orderId} />
        <input type="hidden" name="token" value={view.token ?? ""} />
        <input type="hidden" name="slot_id" value={booking.slotId} />
        {booking.refund && <p className="text-md font-semibold">{booking.refund}</p>}
        {booking.refundNote && <p className="text-sm text-text-2">{booking.refundNote}</p>}
        <p className="text-sm text-text-2">{t("order.booking_cancel_final")}</p>
        <button type="submit" className="gf-btn gf-btn--quiet self-start text-error">
          {t("order.booking_cancel_confirm")}
        </button>
      </form>
    </details>
  )
}

/**
 * A dated order's departures (adr/0076 Ek D7a): each with when and what,
 * and while the backend allows it the cancel, asked first with what comes
 * back, then confirmed. Not drawn without departures.
 */
export function OrderBookings({
  view,
  t,
  actions,
}: {
  view: OrderPageView
  t: Translate
  actions: OrderActions
}) {
  const bookings = view.bookings ?? []
  if (bookings.length === 0) {
    return null
  }
  return (
    <section aria-labelledby="rezervasyonlar" className={WELL}>
      <h2 id="rezervasyonlar" className="text-title">
        {t("order.bookings")}
      </h2>
      <ul className="flex flex-col gap-3 text-sm">
        {bookings.map((booking) => (
          <li key={booking.slotId} className="flex flex-col gap-2 rounded-media gf-pane-inner p-4">
            <span className="font-semibold">{booking.departure}</span>
            {booking.titles && <span className="text-text-2">{booking.titles}</span>}
            {booking.cancelled ? (
              <span className="text-text-2">{t("order.booking_cancelled")}</span>
            ) : booking.cancellable && actions.cancelBooking ? (
              <CancelAsk view={view} booking={booking} t={t} action={actions.cancelBooking} />
            ) : booking.note ? (
              <span className="text-text-2">{booking.note}</span>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  )
}
