import type { MedusaContainer } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import { errorSummary, logger } from "../lib/logging"
import { isLockBusy } from "../workflows/pricing/price-history"
import { searchIndexMinute } from "../workflows/search/upkeep"

/**
 * The search index's minute (adr/0056): price lists that began or ended,
 * products left pending by a stopped process, the first build of a new
 * shop's index. One run at a time across processes.
 */
export default async function searchIndexMinuteJob(container: MedusaContainer) {
  try {
    const indexed = await container
      .resolve(Modules.LOCKING)
      .execute("search-index-minute", () => searchIndexMinute(container), { timeout: 1 })
    if (indexed > 0) {
      logger.info({ event: "search_index.caught_up", indexed })
    }
  } catch (error) {
    if (isLockBusy(error)) {
      return
    }
    logger.error({ event: "search_index.minute_failed", err: errorSummary(error) })
  }
}

export const config = {
  name: "search-index-minute",
  schedule: "* * * * *",
}
