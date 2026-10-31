import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { errorSummary, logger } from "../lib/logging"
import { queueReturnDocument } from "../workflows/einvoice/queue-return"
import { RETURN_REFUNDED } from "../workflows/returns/receive-return"

/**
 * A return's document (gider pusulası, or a company's return invoice)
 * queued once its money is given back (F8 E6, adr/0034 addendum). A
 * failure is logged: staff see the refund on the order and can ask again.
 */
export default async function einvoiceReturn({
  event: { data },
  container,
}: SubscriberArgs<{ id: string }>) {
  try {
    await queueReturnDocument(container, data.id)
  } catch (error) {
    logger.warn({ event: "einvoice.return_queue_failed", err: errorSummary(error) })
  }
}

export const config: SubscriberConfig = { event: RETURN_REFUNDED }
