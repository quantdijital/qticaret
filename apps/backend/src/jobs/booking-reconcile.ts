import type { MedusaContainer } from "@medusajs/framework/types"
import { errorSummary, logger } from "../lib/logging"
import { resumeDepartureCancels } from "../workflows/booking/departure-cancel"
import { reconcileBookings } from "../workflows/booking/reconcile"
import { reconcileTravelers } from "../workflows/booking/reconcile-travelers"

/**
 * Dated orders the order events missed (adr/0076 Ek takip L2), every ten
 * minutes: a placed order's booking confirmed, a cancelled one's bookings
 * cancelled (`workflows/booking/reconcile.ts`), then a booking's travelers
 * that failed to follow it attached (`reconcile-travelers.ts`, adr/0076
 * §7). Logs counts only; one order's failure is logged with its id and
 * the run goes on. On a shop that sells no dated product: three indexed
 * reads that find nothing.
 */
export default async function bookingReconcile(container: MedusaContainer) {
  try {
    const counts = await reconcileBookings(container)
    if (counts.confirmed + counts.cancelled + counts.failed > 0) {
      logger.info({ event: "booking.reconciled", ...counts })
    }
  } catch (error) {
    logger.warn({ event: "booking.reconcile_failed", err: errorSummary(error) })
  }
  try {
    // A departure the shop cancelled, its bookings not all refunded yet (adr/0076 Ek D7a)
    const departures = await resumeDepartureCancels(container)
    if (departures.cancelled + departures.failed > 0) {
      logger.info({ event: "booking.departures_resumed", ...departures })
    }
  } catch (error) {
    logger.warn({ event: "booking.departures_resume_failed", err: errorSummary(error) })
  }
  try {
    const travelers = await reconcileTravelers(container)
    if (travelers.attached + travelers.failed > 0) {
      logger.info({ event: "booking.travelers_reconciled", ...travelers })
    }
  } catch (error) {
    logger.warn({ event: "booking.travelers_reconcile_failed", err: errorSummary(error) })
  }
}

export const config = {
  name: "booking-reconcile",
  schedule: "*/10 * * * *",
}
