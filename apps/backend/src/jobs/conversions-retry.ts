import type { MedusaContainer } from "@medusajs/framework/types"
import { errorSummary, logger } from "../lib/logging"
import { CONVERSIONS_MODULE } from "../modules/conversions"
import type ConversionsModuleService from "../modules/conversions/service"
import {
  sendPurchaseConversionsWorkflow,
  sendRefundConversionWorkflow,
} from "../workflows/conversions/send"

const DAY = 24 * 60 * 60 * 1000
/** How long a failed event is tried again, and the browser's details kept for it. */
const RETRY_DAYS = 3
const MAX_ATTEMPTS = 5

/**
 * Sends again the conversion events Meta or GA4 did not take (F10.9): a
 * purchase or refund sent once already is not sent twice. Past three days
 * the browser's IP and details are forgotten, sent or not.
 */
export default async function conversionsRetry(container: MedusaContainer) {
  const conversions = container.resolve<ConversionsModuleService>(CONVERSIONS_MODULE)
  const since = new Date(Date.now() - RETRY_DAYS * DAY)
  const failed = await conversions.listConversionEvents(
    { status: "failed", created_at: { $gte: since }, attempts: { $lt: MAX_ATTEMPTS } },
    { take: 200, order: { created_at: "ASC" } }
  )
  const purchases = new Set(
    failed.filter((row) => row.kind === "purchase").map((row) => row.order_id)
  )
  for (const orderId of purchases) {
    await sendPurchaseConversionsWorkflow(container)
      .run({ input: { order_id: orderId } })
      .catch((error: unknown) => {
        logger.warn({ event: "conversions.retry_failed", err: errorSummary(error) })
      })
  }
  for (const row of failed.filter((each) => each.kind === "refund")) {
    await sendRefundConversionWorkflow(container)
      .run({
        input: {
          order_id: row.order_id,
          refund_id: row.event_key.split(":").slice(2).join(":"),
          amount: row.amount,
        },
      })
      .catch((error: unknown) => {
        logger.warn({ event: "conversions.retry_failed", err: errorSummary(error) })
      })
  }
  const forgotten = await conversions.forgetStaleClients(since)
  if (failed.length + forgotten > 0) {
    logger.info({ event: "conversions.retried", events: failed.length, forgotten })
  }
}

export const config = {
  name: "conversions-retry",
  schedule: "*/30 * * * *",
}
