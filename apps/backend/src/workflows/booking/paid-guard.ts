import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { bookingMarkOf } from "../../lib/booking/cart-lines"
import { ValidationError } from "../../lib/errors"
import { COD_PAYMENT_PROVIDER_ID } from "../../lib/payments/checkout"
import { BOOKING_MODULE } from "../../modules/booking"
import type { CancelledUse } from "../../modules/booking/refund-uses"
import type BookingModuleService from "../../modules/booking/service"
import { errorSummary, logger } from "../../lib/logging"
import { cashShareOf } from "./cash-share"
import { alertCashShareByHand } from "./confirm-alert"

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

interface PaymentRow {
  provider_id?: string | null
  captured_at?: unknown
  captures?: ({ id?: string | null } | null)[] | null
}

/**
 * Medusa's capture of a payment for an order one of whose departures was
 * cancelled (refund safety follow-up of adr/0076). Refused
 * (`booking.departure_cancelled_unpaid`, review O3) unless it is cash on
 * delivery for an order that still has a line to deliver: the courier's
 * collection is recorded then. Medusa records the whole payment, the
 * cancelled departure's share with it; the departures whose refund was
 * not sent are returned for `settleCashCapture` once the capture went
 * through (review O2 of #277: nothing is written before). A payment
 * captured already (in full or in part) returns none: no second share is
 * owed. Under the order's cancel locks; none when nothing was cancelled.
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
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data: payments } = await query.graph({
    entity: "payment",
    fields: ["provider_id", "captured_at", "captures.id"],
    filters: { id: paymentId },
  })
  const payment = (payments as unknown as PaymentRow[])[0]
  if (payment?.provider_id !== COD_PAYMENT_PROVIDER_ID) {
    throw new ValidationError("booking.departure_cancelled_unpaid")
  }
  const { data } = await query.graph({
    entity: "order",
    fields: ["items.id", "items.metadata"],
    filters: { id: orderId },
  })
  const items = (data as unknown as { items?: (ItemRow | null)[] | null }[])[0]?.items ?? []
  if (!hasLiveLine(items, new Set(cancelled.map((use) => use.slot_id)))) {
    throw new ValidationError("booking.departure_cancelled_unpaid")
  }
  if (payment.captured_at || (payment.captures ?? []).some(Boolean)) {
    return []
  }
  return cancelled.filter((use) => use.cancel_refund === null || use.cancel_refund === "none")
}

/**
 * Once the cash on delivery was captured: each departure `captureForCancelledDeparture`
 * returned is marked owed by hand with its share (`offline`,
 * `refund_due`, worked out on the server by its tier copy), then its
 * bell rings with that share (review O1, O2 of #277). A departure that
 * fails is logged with its ids (an error: money owed) and the rest go on.
 */
export async function settleCashCapture(
  container: MedusaContainer,
  orderId: string,
  owed: readonly CancelledUse[]
): Promise<void> {
  const bookings = container.resolve<BookingModuleService>(BOOKING_MODULE)
  for (const use of owed) {
    try {
      const due = await cashShareOf(container, use)
      if ((await bookings.markUseOwedByHand(use.use_id, due)) && due > 0) {
        await alertCashShareByHand(container, orderId, use.slot_id, due)
      }
    } catch (error) {
      logger.error({
        event: "booking.cash_share_failed",
        order_id: orderId,
        slot_id: use.slot_id,
        err: errorSummary(error),
      })
    }
  }
}
