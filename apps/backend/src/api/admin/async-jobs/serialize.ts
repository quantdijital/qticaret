import type { AsyncJobRecord } from "../../../modules/async-job/service"

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
    input: job.input,
    result_summary: job.result_summary,
    error_code: job.error_code,
    requested_by: job.requested_by,
    created_at: job.created_at,
    started_at: job.started_at,
    finished_at: job.finished_at,
    expires_at: job.expires_at,
    has_result: job.status === "succeeded" && job.result_file_id !== null && !expired,
  }
}
