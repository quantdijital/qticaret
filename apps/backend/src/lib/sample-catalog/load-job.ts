import type { MedusaContainer } from "@medusajs/framework/types"
import { ASYNC_JOB_MODULE } from "../../modules/async-job"
import type AsyncJobModuleService from "../../modules/async-job/service"
import type { AsyncJobStatus } from "../../modules/async-job/service"

/** The background job type a load runs as (`workflows/async-job/types/sample-catalog-load`). */
export const SAMPLE_LOAD_JOB = "sample_catalog.load"

/** The newest sample load as the "Örnek içerik" card shows it: its state, how far, how it ended. */
export interface SampleLoadJob {
  id: string
  pack: string | null
  status: AsyncJobStatus
  progress: number
  /** What it made, once it succeeded (`products`, `categories_made`, `categories_opened`). */
  summary: Record<string, unknown> | null
  error_code: string | null
  created_at: string
}

const packOf = (input: unknown): string | null => {
  const pack = (input as { pack?: unknown } | null)?.pack
  return typeof pack === "string" ? pack : null
}

const iso = (value: Date | string): string =>
  value instanceof Date ? value.toISOString() : new Date(value).toISOString()

/**
 * The ids of this shop's load jobs that did not succeed (failed, cancelled,
 * swept, or still open): a record half made by one of them is a sample
 * (`isSampleRecord`). A job that succeeded marked every record it made.
 */
export async function unfinishedLoadJobs(
  container: Pick<MedusaContainer, "resolve">
): Promise<Set<string>> {
  const jobs = await container
    .resolve<AsyncJobModuleService>(ASYNC_JOB_MODULE)
    .listAsyncJobs(
      { type: SAMPLE_LOAD_JOB, status: ["queued", "running", "failed", "cancelled"] },
      { select: ["id"], take: null }
    )
  return new Set(jobs.map((job) => job.id))
}

/** The newest `sample_catalog.load` job of this shop, of any state, or null. */
export async function latestSampleLoad(
  container: Pick<MedusaContainer, "resolve">
): Promise<SampleLoadJob | null> {
  const [job] = await container
    .resolve<AsyncJobModuleService>(ASYNC_JOB_MODULE)
    .listAsyncJobs(
      { type: SAMPLE_LOAD_JOB },
      { order: { created_at: "DESC", id: "DESC" }, take: 1 }
    )
  if (!job) {
    return null
  }
  return {
    id: job.id,
    pack: packOf(job.input),
    status: job.status,
    progress: job.progress,
    summary: job.result_summary ?? null,
    error_code: job.error_code,
    created_at: iso(job.created_at),
  }
}
