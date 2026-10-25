import { model } from "@medusajs/framework/utils"

export const ASYNC_JOB_STATUSES = ["queued", "running", "succeeded", "failed", "cancelled"] as const

/**
 * One run of a long task (adr/0014): an export, an import, a report. What
 * the admin sees: status, progress, a result file, an error code. `input`
 * holds filters and IDs only, never personal data or secrets.
 */
export const AsyncJob = model
  .define("async_job", {
    id: model.id({ prefix: "ajob" }).primaryKey(),
    type: model.text(),
    status: model.enum([...ASYNC_JOB_STATUSES]).default("queued"),
    attempt: model.number().default(0),
    progress: model.number().default(0),
    progress_key: model.text().nullable(),
    heartbeat_at: model.dateTime().nullable(),
    input: model.json().nullable(),
    result_file_id: model.text().nullable(),
    result_summary: model.json().nullable(),
    error_code: model.text().nullable(),
    requested_by: model.text().nullable(),
    started_at: model.dateTime().nullable(),
    finished_at: model.dateTime().nullable(),
    expires_at: model.dateTime().nullable(),
  })
  .indexes([
    { on: ["status", "heartbeat_at"] },
    { on: ["type", "created_at"] },
    { on: ["expires_at"] },
  ])
