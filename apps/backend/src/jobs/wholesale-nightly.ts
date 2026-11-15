import type { MedusaContainer } from "@medusajs/framework/types"
import { errorSummary, logger } from "../lib/logging"
import { WHOLESALE_MODULE } from "../modules/wholesale"
import type WholesaleModuleService from "../modules/wholesale/service"
import { reconcileWholesaleGroups } from "../workflows/wholesale/accounts/reconcile"
import { removeOrphanMarks } from "../workflows/wholesale/orphans"
import { queueWholesaleSync } from "../workflows/wholesale/queue"

/**
 * Every wholesale list written again each night (ADR-0068 §4): a price
 * change the event missed, a new KDV rate for a product type (a price
 * entered by hand is worked out again from its net amount), a variant
 * added while the job was busy; and a customer left in a wholesale group
 * without an active account taken out. Nothing to do without lists.
 */
export default async function wholesaleNightly(container: MedusaContainer) {
  try {
    const service = container.resolve<WholesaleModuleService>(WHOLESALE_MODULE)
    const lists = await service.wholesaleLists()
    if (lists.length === 0) {
      return
    }
    // Hand-entered prices of variants since deleted go first: nothing to write for them
    const orphans = await removeOrphanMarks(container)
    // Nobody in a wholesale group without the active account that puts them there (review L1)
    const strays = await reconcileWholesaleGroups(container)
    const now = new Date()
    for (const list of lists) {
      await service.requestSync(list, now)
    }
    const queued = await queueWholesaleSync(container, null)
    logger.info({
      event: "wholesale.nightly_queued",
      lists: lists.length,
      orphans,
      strays,
      queued,
    })
  } catch (error) {
    logger.error({ event: "wholesale.nightly_failed", err: errorSummary(error) })
  }
}

export const config = {
  name: "wholesale-nightly",
  // 03:40 UTC, after the segments refresh and before the search index rebuild
  schedule: "40 3 * * *",
}
