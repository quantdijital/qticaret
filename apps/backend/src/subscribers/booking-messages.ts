import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { BOOKING_CANCELLED } from "../workflows/booking/cancel"
import { sendBookingCancelled } from "../workflows/booking/messages"
import type { BookingCancelledEvent } from "../workflows/booking/messages"

/**
 * A cancelled departure told to its shopper (adr/0076 §8, Ek D7b): the
 * shopper's or staff's cancel with its refund or "the shop gives it back
 * by hand", and a departure the shop called off (`by: "shop"`, one event
 * per order as `booking.departure_cancelled`'s run refunds it) with
 * everything paid coming back. A failed send is logged and never undoes
 * the cancel; nothing is thrown, so the event is not delivered again.
 */
export default async function bookingMessages({
  event: { data },
  container,
}: SubscriberArgs<BookingCancelledEvent>) {
  await sendBookingCancelled(container, data)
}

export const config: SubscriberConfig = { event: BOOKING_CANCELLED }
