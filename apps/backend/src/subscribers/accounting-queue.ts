import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { errorSummary, logger } from "../lib/logging"
import { ACCOUNTING_MODULE } from "../modules/accounting"
import type AccountingModuleService from "../modules/accounting/service"
import { activeAccountingAdapter } from "../workflows/accounting/active-adapter"
import { recordsOfEvent } from "../workflows/accounting/queue-records"

/**
 * A sale, its cancellation, a payment taken or money given back, queued
 * for the shop's accounting program when it has one (F11.5, adr/0039 §5).
 * Queuing is one insert that a repeated event leaves alone; the order flow
 * never waits on the program. A failure here is logged: the hourly sweep
 * (jobs/accounting-sync.ts) queues what an event missed.
 */
export default async function accountingQueue({
  event: { name, data },
  container,
}: SubscriberArgs<{ id: string }>) {
  try {
    const { id, adapter } = await activeAccountingAdapter(container)
    if (!adapter) {
      return
    }
    await container
      .resolve<AccountingModuleService>(ACCOUNTING_MODULE)
      .enqueue(id, await recordsOfEvent(container, name, data.id))
  } catch (error) {
    logger.warn({ event: "accounting.queue_failed", source: name, err: errorSummary(error) })
  }
}

export const config: SubscriberConfig = {
  event: ["order.placed", "order.canceled", "payment.captured", "payment.refunded"],
}
