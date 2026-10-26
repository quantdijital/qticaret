import type { MedusaContainer } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import { errorSummary, logger } from "../lib/logging"
import { isLockBusy, recordListBoundaries } from "../workflows/pricing/price-history"

/**
 * Price lists beginning and ending (F4.2, ADR-0023), recorded each minute
 * at the time they did: a sale shorter than the hourly check's interval
 * would otherwise be missing from the 30-day rule's history. One run at a
 * time across processes.
 */
export default async function priceListBoundaries(container: MedusaContainer) {
  try {
    const recorded = await container
      .resolve(Modules.LOCKING)
      .execute("price-list-boundaries", () => recordListBoundaries(container), { timeout: 1 })
    if (recorded > 0) {
      logger.info({ event: "price_history.boundaries_recorded", recorded })
    }
  } catch (error) {
    if (isLockBusy(error)) {
      return
    }
    logger.error({ event: "price_history.boundaries_failed", err: errorSummary(error) })
  }
}

export const config = {
  name: "price-list-boundaries",
  schedule: "* * * * *",
}
