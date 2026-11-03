import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { errorSummary, logger } from "../lib/logging"
import { recordOrderPopularityWorkflow } from "../workflows/search/popularity"

/**
 * An order placed makes its products more popular in search at once
 * (adr/0056); the nightly job counts the 30 days again. Never fails the order.
 */
export default async function searchPopularity({
  event,
  container,
}: SubscriberArgs<{ id: string }>) {
  try {
    await recordOrderPopularityWorkflow(container).run({ input: { order_id: event.data.id } })
  } catch (error) {
    logger.warn({ event: "search_index.popularity_failed", err: errorSummary(error) })
  }
}

export const config: SubscriberConfig = { event: "order.placed" }
