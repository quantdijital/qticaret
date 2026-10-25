import type { MedusaContainer } from "@medusajs/framework/types"
import { errorSummary, logger } from "../lib/logging"
import { announceChanges } from "../workflows/seo/indexnow"

/**
 * Tells IndexNow search engines what changed (F3.15) every ten minutes.
 * A failed call is logged and tried again on the next run, with the same
 * changes and any newer ones.
 */
export default async function seoIndexNow(container: MedusaContainer) {
  try {
    const outcome = await announceChanges(container)
    if ("sent" in outcome) {
      logger.info({ event: "seo.indexnow_sent", urls: outcome.sent })
    }
  } catch (error) {
    logger.warn({ event: "seo.indexnow_failed", err: errorSummary(error) })
  }
}

export const config = {
  name: "seo-indexnow",
  schedule: "*/10 * * * *",
}
