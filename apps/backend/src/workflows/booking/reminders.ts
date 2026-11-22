import type { MedusaContainer } from "@medusajs/framework/types"
import { errorSummary, logger } from "../../lib/logging"
import { BOOKING_MODULE } from "../../modules/booking"
import type BookingModuleService from "../../modules/booking/service"
import { sendMessageWorkflow } from "../messaging/send-message"

/**
 * "Kalkışınız yaklaşıyor" (adr/0076 §8, Ek D7b): each live departure
 * reminded once, the product's `reminder_days` before it (0: never; a
 * booking made inside that window is not reminded). The mark is written
 * after the send, so a run cut short sends it on the next run; the
 * messaging layer's own key keeps that from sending twice. A provider
 * failure leaves the mark off to try again; anything else that holds a
 * message (no address, the shop turned it off) marks it done.
 */

// Departures one run reminds; the next run takes the rest
export const REMINDER_BATCH = 100

export interface ReminderRun {
  sent: number
  failed: number
}

type Send = (useId: string) => Promise<Record<string, unknown>>

const sendReminder =
  (container: MedusaContainer): Send =>
  async (useId) =>
    (
      await sendMessageWorkflow(container).run({
        input: { template: "booking.reminder", resource_id: useId },
      })
    ).result

export async function sendDueReminders(
  container: MedusaContainer,
  now = new Date(),
  send: Send = sendReminder(container)
): Promise<ReminderRun> {
  const service = container.resolve<BookingModuleService>(BOOKING_MODULE)
  const due = await service.dueReminders(now, REMINDER_BATCH)
  const run: ReminderRun = { sent: 0, failed: 0 }
  for (const useId of due) {
    try {
      const outcomes = await send(useId)
      if (Object.values(outcomes).includes("failed")) {
        run.failed += 1
        continue
      }
      await service.markReminded(useId)
      run.sent += 1
    } catch (error) {
      run.failed += 1
      logger.warn({ event: "booking.reminder_failed", use_id: useId, err: errorSummary(error) })
    }
  }
  return run
}
