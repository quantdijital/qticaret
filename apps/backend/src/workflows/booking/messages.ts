import type { MedusaContainer } from "@medusajs/framework/types"
import { errorSummary, logger } from "../../lib/logging"
import type { MessageTemplateName } from "../../lib/messaging/templates"
import { BOOKING_MODULE } from "../../modules/booking"
import type BookingModuleService from "../../modules/booking/service"
import { sendMessageWorkflow } from "../messaging/send-message"
import type { CancelBy } from "./cancel"

/**
 * A booking's e-mails sent where its life moves (adr/0076 §8, Ek D7b).
 * A message that fails is logged with ids only and never undoes what
 * happened: the booking stays confirmed, the cancel stands. The
 * messaging layer sends each template once per resource, so a repeated
 * event or a second run changes nothing.
 */

const OUTCOMES_THAT_CONFIRM = new Set(["confirmed", "retaken", "existing"])

/** Whether a confirmation's outcome leaves a booking to tell the shopper about. */
export const confirmsBooking = (outcome: string): boolean => OUTCOMES_THAT_CONFIRM.has(outcome)

async function send(
  container: MedusaContainer,
  template: MessageTemplateName,
  resourceId: string,
  extra?: Record<string, string>
): Promise<boolean> {
  try {
    await sendMessageWorkflow(container).run({
      input: { template, resource_id: resourceId, ...(extra ? { extra } : {}) },
    })
    return true
  } catch (error) {
    logger.warn({
      event: "booking.message_failed",
      template,
      resource_id: resourceId,
      err: errorSummary(error),
    })
    return false
  }
}

/** "Rezervasyonunuz onaylandı" for each of the order's confirmed bookings. */
export async function sendBookingConfirmations(
  container: MedusaContainer,
  orderId: string
): Promise<void> {
  try {
    const bookings = await container
      .resolve<BookingModuleService>(BOOKING_MODULE)
      .listBookings({ order_id: orderId, status: "confirmed" }, { select: ["id"] })
    for (const booking of bookings) {
      await send(container, "booking.confirmed", booking.id)
    }
  } catch (error) {
    logger.warn({ event: "booking.message_failed", order_id: orderId, err: errorSummary(error) })
  }
}

/** The event `booking.cancelled` carries (`workflows/booking/cancel.ts`). */
export interface BookingCancelledEvent {
  order_id: string
  booking_id: string
  slot_id: string
  by: CancelBy
  refund_by_hand: boolean
}

/** The template a cancel is told with: the shop's whole departure, or one booking's. */
export const cancelTemplateOf = (by: CancelBy): MessageTemplateName =>
  by === "shop" ? "booking.departure_cancelled" : "booking.cancelled"

/** The cancelled departure's e-mail, to the order's address. */
export async function sendBookingCancelled(
  container: MedusaContainer,
  event: BookingCancelledEvent
): Promise<void> {
  try {
    const [use] = await container
      .resolve<BookingModuleService>(BOOKING_MODULE)
      .listBookingSlotUses(
        { booking_id: event.booking_id, slot_id: event.slot_id },
        { take: 1, select: ["id"] }
      )
    if (!use) {
      return
    }
    await send(container, cancelTemplateOf(event.by), use.id, {
      by_hand: event.refund_by_hand ? "1" : "0",
    })
  } catch (error) {
    logger.warn({
      event: "booking.message_failed",
      order_id: event.order_id,
      err: errorSummary(error),
    })
  }
}
