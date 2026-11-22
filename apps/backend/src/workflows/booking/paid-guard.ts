import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { bookingMarkOf } from "../../lib/booking/cart-lines"
import { ValidationError } from "../../lib/errors"
import { COD_PAYMENT_PROVIDER_ID } from "../../lib/payments/checkout"
import { BOOKING_MODULE } from "../../modules/booking"
import type { CancelledUse } from "../../modules/booking/refund-uses"
import type BookingModuleService from "../../modules/booking/service"

type Container = Pick<MedusaContainer, "resolve">

/**
 * Money taken for an order one of whose departures was cancelled before
 * it was paid (review O3): the bank transfer's confirmation and a
 * capture refuse (`booking.departure_cancelled_unpaid`), so nothing is
 * taken for a departure that will not run and no refund is left to chase.
 * Staff cancel the order, or what is left of it, instead. Read under the
 * order's cancel locks by both callers, as the booking cancel writes.
 */
export async function refuseMoneyForCancelledDeparture(
  container: Container,
  orderId: string
): Promise<void> {
  const bookings = container.resolve<BookingModuleService>(BOOKING_MODULE)
  if (await bookings.orderHasCancelledDeparture(orderId)) {
    throw new ValidationError("booking.departure_cancelled_unpaid")
  }
}

interface ItemRow {
  metadata?: unknown
}

/**
 * Whether the order has a line not on a cancelled departure: a parcel's
 * line, or a departure still live. Pure.
 */
export const hasLiveLine = (
  items: readonly (ItemRow | null)[],
  cancelledSlots: ReadonlySet<string>
): boolean =>
  items.some((item) => {
    if (!item) {
      return false
    }
    const mark = bookingMarkOf(item.metadata)
    return !mark || !cancelledSlots.has(mark.slot_id)
  })

/**
 * Medusa's capture of a payment for an order one of whose departures was
 * cancelled (refund safety follow-up of adr/0076). Refused
 * (`booking.departure_cancelled_unpaid`, review O3) unless it is cash on
 * delivery for an order that still has a line to deliver: the courier
 * collected what the parcel carried, the cancelled departure's share
 * with it. The capture goes on then, and the cancelled departures whose
 * money was not sent are marked owed back by hand (`offline`) before it,
 * so the bell rings for them (the caller, once captured; the reconcile's
 * sweep if that is lost). Under the order's cancel locks. The departures
 * whose bell is the caller's; none when nothing was cancelled.
 */
export async function captureForCancelledDeparture(
  container: Container,
  orderId: string,
  paymentId: string
): Promise<CancelledUse[]> {
  const bookings = container.resolve<BookingModuleService>(BOOKING_MODULE)
  const cancelled = await bookings.cancelledUsesOfOrder(orderId)
  if (cancelled.length === 0) {
    return []
  }
  const [payment] = await container
    .resolve(Modules.PAYMENT)
    .listPayments({ id: paymentId }, { select: ["provider_id"] })
  if (payment?.provider_id !== COD_PAYMENT_PROVIDER_ID) {
    throw new ValidationError("booking.departure_cancelled_unpaid")
  }
  const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "order",
    fields: ["items.id", "items.metadata"],
    filters: { id: orderId },
  })
  const items = (data as unknown as { items?: (ItemRow | null)[] | null }[])[0]?.items ?? []
  if (!hasLiveLine(items, new Set(cancelled.map((use) => use.slot_id)))) {
    throw new ValidationError("booking.departure_cancelled_unpaid")
  }
  const owed = cancelled.filter((use) => use.cancel_refund !== "sent")
  await bookings.markUsesOwedByHand(owed.map((use) => use.use_id))
  return owed
}
