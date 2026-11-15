import type { MedusaContainer } from "@medusajs/framework/types"
import { errorSummary, logger } from "../lib/logging"
import { pendingLists } from "../workflows/wholesale/sync"
import { queueWholesaleSync } from "../workflows/wholesale/queue"

/**
 * A wholesale list still waiting to be written (ADR-0068 §4) gets the
 * sync job queued: a request that came as a job was finishing, or one the
 * job's rounds did not reach. Nothing pending, nothing queued; a job
 * already queued or running picks the list up itself.
 */
export default async function wholesaleSweep(container: MedusaContainer) {
  try {
    const pending = await pendingLists(container)
    if (pending.length === 0) {
      return
    }
    const queued = await queueWholesaleSync(container, null)
    logger.info({ event: "wholesale.sweep", pending: pending.length, queued })
  } catch (error) {
    logger.warn({ event: "wholesale.sweep_failed", err: errorSummary(error) })
  }
}

export const config = {
  name: "wholesale-sweep",
  schedule: "*/10 * * * *",
}
