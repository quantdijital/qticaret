import { CUSTOM_SCENE_CODE } from "../../../lib/ai/scene-text"
import { serverErrorMessage } from "../../../lib/errors/messages"
import type { AsyncJobRecord } from "../../../modules/async-job/service"

/** An address a job reads (an old site's feed): its site only, as its path or query may hold a key. */
function originOf(value: unknown): unknown {
  try {
    return typeof value === "string" ? `${new URL(value).origin}/…` : value
  } catch {
    return null
  }
}

// A file the job reads (an import's sheet) stays out like its result's key; a
// list of records (a bulk edit's thousand products) is shown by its length;
// an address by its site. A picture job's one-off scene (`custom`, words the
// shop typed) is shown as the mark `scene: "custom"` only: the words stay in
// the job record for its run, not in what the API hands out (adr/0071 Ek 2026-11-19)
export function publicInput(input: unknown, type?: string): unknown {
  if (input === null || typeof input !== "object" || Array.isArray(input)) {
    return input
  }
  const typedScene =
    type === "ai.image_edit" && typeof (input as { custom?: unknown }).custom === "string"
  return Object.fromEntries(
    Object.entries(input).flatMap(([key, value]): [string, unknown][] => {
      if (key.endsWith("_file_id")) {
        return []
      }
      if (typedScene && key === "custom") {
        return [["scene", CUSTOM_SCENE_CODE]]
      }
      if (key.endsWith("_url")) {
        return [[key, originOf(value)]]
      }
      return key.endsWith("_ids") && Array.isArray(value)
        ? [[`${key.slice(0, -"_ids".length)}_count`, value.length]]
        : [[key, value]]
    })
  )
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
    input: publicInput(job.input, job.type),
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
