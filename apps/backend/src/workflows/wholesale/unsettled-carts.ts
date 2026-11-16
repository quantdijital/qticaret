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

interface CartsRun {
  status: string
  finished_at?: Date | string | null
  input?: unknown
  result_summary?: unknown
}

/** Which re-run the run was: its summary's count, else its input's (a failed run has no summary). */
function attemptOf(run: CartsRun): number {
  const summary = (run.result_summary ?? {}) as { attempt?: unknown }
  const input = (run.input ?? {}) as { attempt?: unknown }
  const attempt = typeof summary.attempt === "number" ? summary.attempt : input.attempt
  return typeof attempt === "number" ? attempt : 0
}

/**
 * The run left carts unsettled: it ended with the lists changing through
 * its rounds, or it failed (an error, or the sweeper found it stopped:
 * `interrupted`, #93 review D2). A cancelled run was stopped on purpose.
 */
function leftUnsettled(run: CartsRun): boolean {
  if (run.status === "failed") {
    return true
  }
  const summary = (run.result_summary ?? {}) as { settled?: unknown }
  return run.status === "succeeded" && summary.settled === false
}

/**
 * The carts job queued again when its last run left carts unsettled
 * (`leftUnsettled`): it cannot queue itself, being one at a time while it
 * runs. At most MAX_CARTS_REQUEUES times in a row; past that an error is
 * logged. Nothing else sweeps them later: a cart still at old prices is
 * put right when it is paid for, the payment start pricing it again and
 * the order's completion refusing it (`wholesale.prices_changed`, ADR-0068
 * slice 4); this run only spares the shopper that refusal.
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
  const finished = last ? last.finished_at : null
  if (!last || !finished || new Date(finished).getTime() < now.getTime() - LOOK_BACK_MS) {
    return "none"
  }
  if (!leftUnsettled(last)) {
    return "none"
  }
  const attempt = attemptOf(last)
  if (attempt >= MAX_CARTS_REQUEUES) {
    logger.error({
      event: "wholesale.carts_unsettled_gave_up",
      jobId: last.id,
      attempt,
      status: last.status,
    })
    return "gave_up"
  }
  return (await queueWholesaleCarts(container, null, attempt + 1)) ? "queued" : "busy"
}
