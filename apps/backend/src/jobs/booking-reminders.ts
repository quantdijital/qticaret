import type { MedusaContainer } from "@medusajs/framework/types"
import { errorSummary, logger } from "../lib/logging"
import { sendDueReminders } from "../workflows/booking/reminders"

/**
 * Departure reminders (adr/0076 Ek D7b), every hour: each live departure
 * reminded once, its product's days before (`workflows/booking/reminders`).
 * Logs counts only. On a shop with no dated product: one indexed read
 * that finds nothing.
 */
export default async function bookingReminders(container: MedusaContainer) {
  try {
    const run = await sendDueReminders(container)
    if (run.sent + run.failed > 0) {
      logger.info({ event: "booking.reminders_sent", ...run })
    }
  } catch (error) {
    logger.warn({ event: "booking.reminders_failed", err: errorSummary(error) })
  }
}

export const config = {
  name: "booking-reminders",
  schedule: "17 * * * *",
}
