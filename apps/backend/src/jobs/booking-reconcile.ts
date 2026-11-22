import type { MedusaContainer } from "@medusajs/framework/types"
import { errorSummary, logger } from "../lib/logging"
import { reconcileBookings } from "../workflows/booking/reconcile"

/**
 * Dated orders the order events missed (adr/0076 Ek takip L2), every ten
 * minutes: a placed order's booking confirmed, a cancelled one's bookings
 * cancelled (`workflows/booking/reconcile.ts`). Logs counts only; one
 * order's failure is logged with its id and the run goes on. On a shop
 * that sells no dated product: two indexed reads that find nothing.
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
}

export const config = {
  name: "booking-reconcile",
  schedule: "*/10 * * * *",
}
