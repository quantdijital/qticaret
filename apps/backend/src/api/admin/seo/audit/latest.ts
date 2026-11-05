import type { MedusaContainer } from "@medusajs/framework/types"
import { ASYNC_JOB_MODULE } from "../../../../modules/async-job"
import type AsyncJobModuleService from "../../../../modules/async-job/service"
import type { AsyncJobRecord, AsyncJobStatus } from "../../../../modules/async-job/service"

export const AUDIT_JOB = "seo.audit"

/**
 * The newest audit run, of any state or only `status`: the night's and the
 * ones staff started alike, the shop's audit either way.
 */
export async function latestAudit(
  container: Pick<MedusaContainer, "resolve">,
  status?: AsyncJobStatus
): Promise<AsyncJobRecord | null> {
  const [job] = await container
    .resolve<AsyncJobModuleService>(ASYNC_JOB_MODULE)
    .listAsyncJobs(
      { type: AUDIT_JOB, ...(status ? { status } : {}) },
      { order: { created_at: "DESC", id: "DESC" }, take: 1 }
    )
  return job ?? null
}

/** Whether the run's report file is still kept (adr/0014: results expire). */
export const hasReport = (job: AsyncJobRecord): boolean =>
  job.status === "succeeded" &&
  job.result_file_id !== null &&
  (job.expires_at === null || new Date(job.expires_at) >= new Date())
