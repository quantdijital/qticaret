import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"
import { kurus } from "../../lib/money"
import type { Kurus } from "../../lib/money"
import { bookingCancelReference } from "../../lib/orders/locks"
import { BOOKING_MODULE } from "../../modules/booking"
import type BookingModuleService from "../../modules/booking/service"
import { ORDER_REFUNDS_MODULE } from "../../modules/order-refunds"
import type OrderRefundsModuleService from "../../modules/order-refunds/service"
import { readOrderMoney } from "../orders/order-money"
import type { BookingCancelInput, BookingCancelResult } from "./cancel"
import { alertRefundByHand } from "./confirm-alert"
import { TAKEN_PAYMENT_FIELDS, isManualRefund, takenByHandOf, takenPaymentsOf } from "./refund-way"
import type { PaidOrderRow } from "./refund-way"

/**
 * A departure's cancel asked again once done (adr/0076 Ek D7a): the same
 * answer, read from the ledger, nothing more given back; staff's retry
 * rings the refund bell again when the money is theirs to give back.
 */

/** What the departure's refund gave, from the ledger: one made by an earlier try counts. */
export async function refundedBefore(container: MedusaContainer, useId: string): Promise<Kurus> {
  const [entry] = await container
    .resolve<OrderRefundsModuleService>(ORDER_REFUNDS_MODULE)
    .listOrderRefunds({ reference: bookingCancelReference(useId) }, { take: 1 })
  return kurus(entry && entry.status !== "failed" ? entry.amount : 0)
}

interface DoneOrder extends PaidOrderRow {
  status?: string | null
}

/**
 * Whether the order's money goes back by hand as it stands now: taken
 * other than by one hosted card form (`takenByHandOf`), or credit used.
 * Only a guess for a departure cancelled before its way was kept.
 */
export async function moneyBackByHand(
  container: MedusaContainer,
  orderId: string,
  order?: PaidOrderRow
): Promise<boolean> {
  const row =
    order ??
    (
      (
        await container.resolve(ContainerRegistrationKeys.QUERY).graph({
          entity: "order",
          fields: TAKEN_PAYMENT_FIELDS,
          filters: { id: orderId },
        })
      ).data as unknown as PaidOrderRow[]
    )[0]
  const taken = takenPaymentsOf(row)
  if (taken.length > 0 && takenByHandOf(taken)) {
    return true
  }
  return (await readOrderMoney(container, orderId)).credit > 0
}

/**
 * Whether a cancelled departure's refund is staff's to give by hand: the
 * way its cancel kept (`cancel_refund`) decides; a refund sent or none
 * due rings nothing (a tier that kept it all, a share sent). Cancelled
 * before the way was kept (null): guessed from the order as it is now.
 */
export async function owedByHand(
  container: MedusaContainer,
  orderId: string,
  kept: string | null,
  order?: PaidOrderRow
): Promise<boolean> {
  if (kept !== null) {
    return isManualRefund(kept)
  }
  return moneyBackByHand(container, orderId, order)
}

/**
 * No live departure on the slot: cancelled before (the same answer) or
 * never the order's. Staff's cancel asked again after the places went
 * back with no refund made rings the refund bell again when its cancel
 * left the money to staff (security review of D7a and its follow-up): a
 * run that stopped between the places and the bell is caught up; a bell
 * rung before is not repeated (its key).
 */
export async function doneBefore(
  container: MedusaContainer,
  input: BookingCancelInput
): Promise<BookingCancelResult> {
  const bookings = container.resolve<BookingModuleService>(BOOKING_MODULE)
  const ofOrder = await bookings.listBookings({ order_id: input.order_id }, { select: ["id"] })
  const [use] =
    ofOrder.length === 0
      ? []
      : await bookings.listBookingSlotUses(
          { booking_id: ofOrder.map((booking) => booking.id), slot_id: input.slot_id },
          { take: 1, select: ["id", "cancelled_at", "cancel_refund"] }
        )
  if (!use) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "booking.cancel_unknown")
  }
  const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "order",
    fields: ["status", ...TAKEN_PAYMENT_FIELDS],
    filters: { id: input.order_id },
  })
  const order = (data as unknown as DoneOrder[])[0]
  const refunded = await refundedBefore(container, use.id)
  if (
    use.cancelled_at &&
    refunded <= 0 &&
    input.by !== "customer" &&
    (await owedByHand(container, input.order_id, use.cancel_refund ?? null, order))
  ) {
    await alertRefundByHand(container, input.order_id, input.slot_id)
  }
  return {
    order_id: input.order_id,
    slot_id: input.slot_id,
    cancelled: false,
    refunded,
    refund_by_hand: kurus(0),
    manual: null,
    order_cancelled: order?.status === "canceled",
  }
}
