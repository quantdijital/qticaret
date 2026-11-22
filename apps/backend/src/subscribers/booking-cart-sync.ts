import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { errorSummary, logger } from "../lib/logging"
import { bookingEnabled } from "../workflows/booking/cart/target"
import { syncCartHoldWorkflow } from "../workflows/booking/cart/sync-hold"

/**
 * A changed cart's hold brought down to its dated lines (adr/0076 §5): a
 * line removed through Medusa's own route gives its places back. Only with
 * the shop's bookings on (off, nothing is read: K11). A failure is only
 * logged: the payment's start trims the hold too, and the sweep frees an
 * ended one.
 */
export default async function bookingCartSync({
  event: { data },
  container,
}: SubscriberArgs<{ id: string }>) {
  try {
    if (!(await bookingEnabled(container))) {
      return
    }
    await syncCartHoldWorkflow(container).run({ input: { cart_id: data.id } })
  } catch (error) {
    logger.warn({ event: "booking.cart_sync_failed", cart_id: data.id, err: errorSummary(error) })
  }
}

export const config: SubscriberConfig = { event: "cart.updated" }
