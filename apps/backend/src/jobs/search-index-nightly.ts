import type { MedusaContainer } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import { errorSummary, logger } from "../lib/logging"
import { isLockBusy } from "../workflows/pricing/price-history"
import { searchIndexNightly } from "../workflows/search/upkeep"

// A large catalogue's rebuild may take minutes; the lock outlives it
const LOCK_TTL_SECONDS = 3 * 60 * 60

/**
 * The search index checked against the catalogue each night (adr/0056):
 * every product indexed again, popularity of the last 30 days counted
 * again, the word dictionary recounted. Catalogue writes go on meanwhile:
 * the rebuild reads and writes in batches, as the drain does.
 */
export default async function searchIndexNightlyJob(container: MedusaContainer) {
  try {
    const result = await container
      .resolve(Modules.LOCKING)
      .execute("search-index-nightly", () => searchIndexNightly(container), {
        timeout: 1,
        expire: LOCK_TTL_SECONDS,
      })
    logger.info({ event: "search_index.nightly", ...result })
  } catch (error) {
    if (isLockBusy(error)) {
      return
    }
    logger.error({ event: "search_index.nightly_failed", err: errorSummary(error) })
  }
}

export const config = {
  name: "search-index-nightly",
  schedule: "10 4 * * *",
}
