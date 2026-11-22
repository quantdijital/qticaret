import type { MedusaContainer } from "@medusajs/framework/types"
import { ValidationError } from "../../lib/errors"
import { BOOKING_MODULE } from "../../modules/booking"
import type BookingModuleService from "../../modules/booking/service"

/**
 * Money taken for an order one of whose departures was cancelled before
 * it was paid (review O3): the bank transfer's confirmation and a
 * capture refuse (`booking.departure_cancelled_unpaid`), so nothing is
 * taken for a departure that will not run and no refund is left to chase.
 * Staff cancel the order, or what is left of it, instead. Read under the
 * order's cancel locks by both callers, as the booking cancel writes.
 */
export async function refuseMoneyForCancelledDeparture(
  container: Pick<MedusaContainer, "resolve">,
  orderId: string
): Promise<void> {
  const bookings = container.resolve<BookingModuleService>(BOOKING_MODULE)
  if (await bookings.orderHasCancelledDeparture(orderId)) {
    throw new ValidationError("booking.departure_cancelled_unpaid")
  }
}
