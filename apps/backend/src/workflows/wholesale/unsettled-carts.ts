import type { MedusaContainer } from "@medusajs/framework/types"
import { logger } from "../../lib/logging"
import { ASYNC_JOB_MODULE } from "../../modules/async-job"
import type AsyncJobModuleService from "../../modules/async-job/service"
import { MAX_CARTS_REQUEUES, WHOLESALE_CARTS_JOB } from "../async-job/types/wholesale-carts"
import { queueWholesaleCarts } from "./queue"

// A run is looked at for this long after it ends: the sweep runs every
// 10 minutes, so each unsettled run is met once or twice, never for a day
const LOOK_BACK_MS = 15 * 60 * 1000

export type UnsettledOutcome = "none" | "queued" | "busy" | "gave_up"

/**
 * The carts job queued again when its last run ended unsettled (the lists
 * kept changing through its rounds): it cannot queue itself, being one at
 * a time while it runs. At most MAX_CARTS_REQUEUES times in a row; past
 * that an error is logged and the night's sync and later flag turns are
 * left to put the carts right.
 */
export async function requeueUnsettledCarts(
  container: MedusaContainer,
  now: Date = new Date()
): Promise<UnsettledOutcome> {
  const [last] = await container
    .resolve<AsyncJobModuleService>(ASYNC_JOB_MODULE)
    .listAsyncJobs(
      { type: WHOLESALE_CARTS_JOB },
      { order: { created_at: "DESC", id: "DESC" }, take: 1 }
    )
  const finished = last?.status === "succeeded" ? last.finished_at : null
  if (!last || !finished || new Date(finished).getTime() < now.getTime() - LOOK_BACK_MS) {
    return "none"
  }
  const summary = (last.result_summary ?? {}) as { settled?: unknown; attempt?: unknown }
  if (summary.settled !== false) {
    return "none"
  }
  const attempt = typeof summary.attempt === "number" ? summary.attempt : 0
  if (attempt >= MAX_CARTS_REQUEUES) {
    logger.error({ event: "wholesale.carts_unsettled_gave_up", jobId: last.id, attempt })
    return "gave_up"
  }
  return (await queueWholesaleCarts(container, null, attempt + 1)) ? "queued" : "busy"
}
