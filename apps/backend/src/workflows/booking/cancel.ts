import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, MedusaError, Modules } from "@medusajs/framework/utils"
import { cancelOrderWorkflow } from "@medusajs/medusa/core-flows"
import { errorSummary, logger } from "../../lib/logging"
import { kurus } from "../../lib/money"
import type { Kurus } from "../../lib/money"
import { bookingCancelReference, cancelLockKeys } from "../../lib/orders/locks"
import { BOOKING_MODULE } from "../../modules/booking"
import type BookingModuleService from "../../modules/booking/service"
import { ORDER_REFUNDS_MODULE } from "../../modules/order-refunds"
import type OrderRefundsModuleService from "../../modules/order-refunds/service"
import { refundOrderWorkflow } from "../orders/refund-order"
import { customerCancelRefusal, planBookingCancel, refuse } from "./cancel-plan"
import type { CancelMode, CancelPlan, ManualRefund } from "./cancel-plan"
import { alertRefundByHand } from "./confirm-alert"

/**
 * One departure of an order cancelled with its money back (adr/0076 §8,
 * Ek D7a), under the order's booking lock (`booking:order:<id>`, the
 * confirmation's and the order cancel's) and its cancel locks (the bank
 * transfer's confirmation and the ship lock, review O3): the plan is read
 * under them, the refund made through the order refunds
 * (`refundOrderWorkflow`, its own lock and ledger), then the departure's
 * places given back. The refund goes first: if the provider fails,
 * nothing changed and the cancel can be asked again; tried again after
 * the refund went through, its reference (`booking<use>`) finds it made
 * and only the places follow. Amounts are the plan's, never a request's.
 *
 * Money the plan leaves to staff (`manual`: taken by hand, credit used, a
 * share above the payments) is not sent: the places go back and the
 * panel's bell says it is to be refunded by hand (review O1, O2). With
 * nothing paid, an order of dated lines only is cancelled once none of
 * its departures is left (review O3).
 */

/** A departure's booking cancelled: the event D7b's messages will follow. */
export const BOOKING_CANCELLED = "booking.cancelled"

export type CancelBy = "customer" | "staff" | "shop"

export interface BookingCancelInput {
  order_id: string
  slot_id: string
  mode: CancelMode
  by: CancelBy
  /** The shopper's own customer record: another's order is no order. */
  customer_id?: string | null | undefined
  /** Staff's user id, written on the refund. */
  created_by?: string | null | undefined
}

export interface BookingCancelResult {
  order_id: string
  slot_id: string
  /** False when the departure was cancelled before (the same answer, nothing done). */
  cancelled: boolean
  /** Kuruş given back by this departure's refund (its ledger entry when made before). */
  refunded: Kurus
  /** Kuruş left to staff to give back by hand, and why (none when sent or nothing due). */
  refund_by_hand: Kurus
  manual: ManualRefund | null
  /** The order cancelled with it (nothing paid, no departure left). */
  order_cancelled: boolean
}

const LOCK_TIMEOUT_SECONDS = 10

export const bookingOrderLockKey = (orderId: string): string => `booking:order:${orderId}`

/** The locks a booking cancel holds: the booking's, then the order's cancel locks. */
export const bookingCancelLockKeys = (orderId: string): string[] => [
  bookingOrderLockKey(orderId),
  ...cancelLockKeys(orderId),
]

/** What the departure's refund gave, from the ledger: one made by an earlier try counts. */
async function refundedBefore(container: MedusaContainer, useId: string): Promise<Kurus> {
  const [entry] = await container
    .resolve<OrderRefundsModuleService>(ORDER_REFUNDS_MODULE)
    .listOrderRefunds({ reference: bookingCancelReference(useId) }, { take: 1 })
  return kurus(entry && entry.status !== "failed" ? entry.amount : 0)
}

/** Whether the refund is sent now: due, and not left to staff. Pure. */
export const sendsRefund = (plan: Pick<CancelPlan, "request" | "refund" | "manual">): boolean =>
  Boolean(plan.request) && plan.refund > 0 && plan.manual === null

/**
 * Whether the order itself goes with this departure (review O3): nothing
 * was paid, every line is dated and no departure is left live. Pure.
 */
export const cancelsOrder = (
  plan: Pick<CancelPlan, "unpaid" | "dated_only" | "order_status">,
  liveLeft: number
): boolean => plan.unpaid && plan.dated_only && liveLeft === 0 && plan.order_status !== "canceled"

/**
 * The unpaid order cancelled (Medusa's cancel: its held payment voided,
 * `order.canceled`). Inside the cancel locks; a refusal (a parcel packed)
 * is logged and the departure's cancel stands: the bank transfer's
 * confirmation refuses it anyway (`refuseMoneyForCancelledDeparture`).
 */
async function cancelUnpaidOrder(
  container: MedusaContainer,
  orderId: string,
  by: string | null
): Promise<boolean> {
  try {
    await cancelOrderWorkflow(container).run({
      input: { order_id: orderId, ...(by ? { canceled_by: by } : {}) },
    })
    return true
  } catch (error) {
    logger.warn({
      event: "booking.unpaid_order_cancel_failed",
      order_id: orderId,
      err: errorSummary(error),
    })
    return false
  }
}

/** The plan carried out: refund (or staff's by hand), then the places. Under the locks. */
async function carryOut(
  container: MedusaContainer,
  plan: CancelPlan,
  input: BookingCancelInput
): Promise<BookingCancelResult> {
  const reference = bookingCancelReference(plan.use_id)
  if (sendsRefund(plan) && plan.request) {
    await refundOrderWorkflow(container).run({
      input: {
        order_id: plan.order_id,
        reference,
        request: plan.request,
        note: `booking cancelled by the ${input.by}`,
        created_by: input.created_by ?? null,
      },
    })
  }
  const bookings = container.resolve<BookingModuleService>(BOOKING_MODULE)
  const changed = await bookings.cancelBookingSlot(plan.use.booking_id, plan.use.slot_id)
  const byHand = changed && plan.manual !== null ? plan.refund : kurus(0)
  if (changed) {
    await container.resolve(Modules.EVENT_BUS).emit({
      name: BOOKING_CANCELLED,
      data: {
        order_id: plan.order_id,
        booking_id: plan.use.booking_id,
        slot_id: plan.use.slot_id,
        by: input.by,
        refund_by_hand: plan.manual !== null,
      },
    })
    if (byHand > 0) {
      await alertRefundByHand(container, plan.order_id, plan.use.slot_id)
    }
  }
  const orderCancelled =
    changed &&
    cancelsOrder(plan, (await bookings.liveUsesOfOrder(plan.order_id)).length) &&
    (await cancelUnpaidOrder(container, plan.order_id, input.created_by ?? null))
  return {
    order_id: plan.order_id,
    slot_id: plan.use.slot_id,
    cancelled: changed,
    refunded: await refundedBefore(container, plan.use_id),
    refund_by_hand: byHand,
    manual: changed ? plan.manual : null,
    order_cancelled: orderCancelled,
  }
}

/**
 * The departure cancelled now. The shopper's: only their own order (else
 * `orders.unknown`), by its tier, before the day, paid by card and with
 * no credit (`customerCancelRefusal`). Staff's: the tier or everything
 * (`full`), any time; with no tier set only `full`
 * (`booking.cancel_unavailable`). Asked again once done: the same answer,
 * nothing more given back.
 */
export async function cancelBookingDeparture(
  container: MedusaContainer,
  input: BookingCancelInput,
  now = new Date()
): Promise<BookingCancelResult> {
  return container.resolve(Modules.LOCKING).execute(
    bookingCancelLockKeys(input.order_id),
    async () => {
      const plan = await planBookingCancel(container, {
        order_id: input.order_id,
        slot_id: input.slot_id,
        mode: input.mode,
        now,
      })
      if (!plan) {
        return doneBefore(container, input)
      }
      if (input.by === "customer") {
        if (!plan.customer_id || plan.customer_id !== input.customer_id) {
          throw new MedusaError(MedusaError.Types.NOT_FOUND, "orders.unknown")
        }
        const reason = customerCancelRefusal(plan, now)
        if (reason) {
          refuse(reason)
        }
      } else if (!plan.rule) {
        refuse("booking.cancel_unavailable")
      }
      return carryOut(container, plan, input)
    },
    { timeout: LOCK_TIMEOUT_SECONDS }
  )
}

/** No live departure on the slot: cancelled before (the same answer) or never the order's. */
async function doneBefore(
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
          { take: 1, select: ["id", "cancelled_at"] }
        )
  if (!use) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "booking.cancel_unknown")
  }
  const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "order",
    fields: ["status"],
    filters: { id: input.order_id },
  })
  return {
    order_id: input.order_id,
    slot_id: input.slot_id,
    cancelled: false,
    refunded: await refundedBefore(container, use.id),
    refund_by_hand: kurus(0),
    manual: null,
    order_cancelled: (data as { status?: string }[])[0]?.status === "canceled",
  }
}
