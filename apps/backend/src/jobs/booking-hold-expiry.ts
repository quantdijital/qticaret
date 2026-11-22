import type { MedusaContainer } from "@medusajs/framework/types"
import { logger } from "../lib/logging"
import { BOOKING_MODULE } from "../modules/booking"
import type BookingModuleService from "../modules/booking/service"
import { SWEEP_BATCH } from "../modules/booking/sql"

// Batches a run sweeps at most; a backlog past this waits a minute
const MAX_BATCHES = 20

/**
 * Carts' holds past their end released and their places given back
 * (adr/0076 §5), every minute. Reads already leave expired holds out and
 * a new hold on a slot releases them first, so a late run blocks no
 * place; this keeps the counters and the table small. Nothing to do on a
 * shop that sells no dated product: one indexed read of an empty table.
 */
export default async function bookingHoldExpiry(container: MedusaContainer) {
  const booking = container.resolve<BookingModuleService>(BOOKING_MODULE)
  let released = 0
  for (let batch = 0; batch < MAX_BATCHES; batch += 1) {
    const count = await booking.releaseExpiredHolds()
    released += count
    if (count < SWEEP_BATCH) {
      break
    }
  }
  if (released > 0) {
    logger.info({ event: "booking.holds_expired", released })
  }
}

export const config = {
  name: "booking-hold-expiry",
  schedule: "* * * * *",
}
