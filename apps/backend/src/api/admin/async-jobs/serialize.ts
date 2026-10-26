import { serverErrorMessage } from "../../../lib/errors/messages"
import type { AsyncJobRecord } from "../../../modules/async-job/service"

// A file the job reads (an import's sheet) stays out like its result's key
function publicInput(input: unknown): unknown {
  if (input === null || typeof input !== "object" || Array.isArray(input)) {
    return input
  }
  return Object.fromEntries(Object.entries(input).filter(([key]) => !key.endsWith("_file_id")))
}

/**
 * A job as the admin API shows it: named fields only. The result file's key
 * stays out: with it, Medusa's own `/admin/uploads/:id` would hand the file
 * out past this API's actor check and read record.
 */
export function serializeJob(job: AsyncJobRecord) {
  const expired = job.expires_at !== null && new Date(job.expires_at) < new Date()
  return {
    id: job.id,
    type: job.type,
    status: job.status,
    attempt: job.attempt,
    progress: job.progress,
    progress_key: job.progress_key,
    input: publicInput(job.input),
    result_summary: job.result_summary,
    error_code: job.error_code,
    // The sentence for the code, as the panel shows API errors (adr/0021)
    error_message: job.error_code ? serverErrorMessage(job.error_code, "tr") : null,
    requested_by: job.requested_by,
    created_at: job.created_at,
    started_at: job.started_at,
    finished_at: job.finished_at,
    expires_at: job.expires_at,
    has_result: job.status === "succeeded" && job.result_file_id !== null && !expired,
  }
}
