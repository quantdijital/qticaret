import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { errorSummary, logger } from "../lib/logging"
import {
  cancelOrderBookingsWorkflow,
  confirmOrderBookingsWorkflow,
} from "../workflows/booking/orders"

/**
 * A dated order's places (adr/0076 §5, §8): placed, its cart's hold
 * becomes its booking (`held → sold`); cancelled, its bookings are
 * cancelled and their places given back. Not a completion hook (the
 * loyalty plugin holds `orderCreated`): `order.placed` comes only for an
 * order really placed. Both run under the order's lock and are
 * idempotent, so a repeated event changes nothing; a failure is logged
 * and thrown for the event's retry. An order without dated lines reads
 * nothing more than its lines.
 */
export default async function bookingOrders({
  event: { name, data },
  container,
}: SubscriberArgs<{ id: string }>) {
  try {
    if (name === "order.canceled") {
      await cancelOrderBookingsWorkflow(container).run({ input: { order_id: data.id } })
      return
    }
    await confirmOrderBookingsWorkflow(container).run({ input: { order_id: data.id } })
  } catch (error) {
    logger.error({
      event: "booking.order_sync_failed",
      name,
      order_id: data.id,
      err: errorSummary(error),
    })
    throw error
  }
}

export const config: SubscriberConfig = { event: ["order.placed", "order.canceled"] }
