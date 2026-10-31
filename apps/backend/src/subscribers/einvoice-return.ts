import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { errorSummary, logger } from "../lib/logging"
import { queueExchangeSale } from "../workflows/einvoice/queue-exchange"
import { queueReturnDocument } from "../workflows/einvoice/queue-return"
import { RETURN_RECEIVED, RETURN_REFUNDED } from "../workflows/returns/receive-return"

/**
 * A return's document (gider pusulası, or a company's return invoice)
 * queued once its money is given back (F8 E6, adr/0034 addendum); an
 * exchange's, with its new sale, once its goods came back (E6b). A
 * failure is logged: the hourly sweep tries the day's again, and the sale
 * invoice's issue queues what an unissued sale left waiting.
 */
export default async function einvoiceReturn({
  event: { data },
  container,
}: SubscriberArgs<{ id: string }>) {
  try {
    await queueReturnDocument(container, data.id)
    // A return's request is not an exchange: left alone
    await queueExchangeSale(container, data.id)
  } catch (error) {
    logger.warn({ event: "einvoice.return_queue_failed", err: errorSummary(error) })
  }
}

export const config: SubscriberConfig = { event: [RETURN_REFUNDED, RETURN_RECEIVED] }
