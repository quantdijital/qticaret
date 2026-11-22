import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { errorSummary, logger } from "../lib/logging"
import { DEPARTURE_CANCELLED, processDepartureCancel } from "../workflows/booking/departure-cancel"

/**
 * A departure the shop cancelled (adr/0076 Ek D7a): its bookings
 * cancelled with their money back, after the panel's answer. Not thrown
 * again on a failure: one order's failure is the run's to count, and the
 * reconcile job carries on whatever is left every ten minutes.
 */
export default async function bookingDepartureCancel({
  event: { data },
  container,
}: SubscriberArgs<{ slot_id: string }>) {
  try {
    const run = await processDepartureCancel(container, data.slot_id)
    logger.info({ event: "booking.departure_cancel_run", slot_id: data.slot_id, ...run })
  } catch (error) {
    logger.error({
      event: "booking.departure_cancel_failed",
      slot_id: data.slot_id,
      err: errorSummary(error),
    })
  }
}

export const config: SubscriberConfig = { event: DEPARTURE_CANCELLED }
