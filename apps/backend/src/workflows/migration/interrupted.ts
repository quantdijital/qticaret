import type { MedusaContainer } from "@medusajs/framework/types"
import { ASYNC_JOB_MODULE } from "../../modules/async-job"
import type AsyncJobModuleService from "../../modules/async-job/service"
import { MIGRATION_MODULE } from "../../modules/migration"
import type MigrationModuleService from "../../modules/migration/service"

type Container = Pick<MedusaContainer, "resolve">

// A job in one of these will never move its run on
const ENDED = new Set(["succeeded", "failed", "cancelled"])

/**
 * Runs left `running` by a job that ended without them (adr/0042 §9): the
 * sweeper failed it as `interrupted` (a crash, a restart) or it ended some
 * other way the run never heard of. Each becomes failed with the job's
 * code, so the panel shows it stopped half-way and offers to start it
 * again. A run whose job is gone is interrupted too. How many were settled.
 */
export async function settleInterruptedRuns(container: Container): Promise<number> {
  const migration = container.resolve<MigrationModuleService>(MIGRATION_MODULE)
  const runs = await migration.listMigrationRuns(
    { status: "running" },
    { select: ["id", "job_id"], take: 100 }
  )
  if (runs.length === 0) {
    return 0
  }
  const jobIds = runs.flatMap((run) => (run.job_id ? [run.job_id] : []))
  const jobs = new Map(
    (jobIds.length > 0
      ? await container
          .resolve<AsyncJobModuleService>(ASYNC_JOB_MODULE)
          .listAsyncJobs(
            { id: jobIds },
            { select: ["id", "status", "error_code", "finished_at"], take: jobIds.length }
          )
      : []
    ).map((job) => [job.id, job])
  )
  let settled = 0
  for (const run of runs) {
    const job = run.job_id ? jobs.get(run.job_id) : undefined
    if (job && !ENDED.has(job.status)) {
      continue
    }
    const finished_at = job?.finished_at ?? new Date()
    await migration.updateMigrationRuns({
      selector: { id: run.id, status: "running" },
      // A job that succeeded wrote its report: only the run's last write was lost
      data:
        job?.status === "succeeded"
          ? { status: "done", finished_at }
          : { status: "failed", error_code: job?.error_code ?? "interrupted", finished_at },
    })
    settled += 1
  }
  return settled
}
