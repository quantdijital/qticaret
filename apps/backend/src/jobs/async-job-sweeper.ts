import type { MedusaContainer } from "@medusajs/framework/types"
import { logger } from "../lib/logging"
import { ASYNC_JOB_MODULE } from "../modules/async-job"
import type AsyncJobModuleService from "../modules/async-job/service"
import { settleInterruptedRuns } from "../workflows/migration/interrupted"

// A running job writes a heartbeat at least as often as it reports progress
const STALE_AFTER_MS = 10 * 60 * 1000

/**
 * Running jobs that stopped beating (a crash, a restart) become failed:
 * `interrupted` (adr/0014). A migration run such a job leaves behind goes
 * with it, so the panel no longer shows it running (adr/0042 §9).
 */
export default async function asyncJobSweeper(container: MedusaContainer) {
  const ids = await container
    .resolve<AsyncJobModuleService>(ASYNC_JOB_MODULE)
    .sweepInterrupted(STALE_AFTER_MS)
  if (ids.length > 0) {
    logger.warn({ event: "async_job.interrupted", count: ids.length })
  }
  const runs = await settleInterruptedRuns(container)
  if (runs > 0) {
    logger.warn({ event: "migration.runs_interrupted", count: runs })
  }
}

export const config = {
  name: "async-job-sweeper",
  schedule: "*/5 * * * *",
}
