import { model } from "@medusajs/framework/utils"

export const RUN_MODES = ["check", "apply"] as const
export const RUN_STATUSES = ["running", "done", "failed"] as const

/**
 * One pass of a migration (F14, adr/0042 §9): a dry run (check) or the
 * real one (apply), from one source, its counts by kind as it went. The
 * job behind it keeps its report file.
 */
export const MigrationRun = model.define("migration_run", {
  id: model.id({ prefix: "mrun" }).primaryKey(),
  source: model.text(),
  mode: model.enum([...RUN_MODES]),
  status: model.enum([...RUN_STATUSES]).default("running"),
  job_id: model.text().nullable(),
  started_by: model.text().nullable(),
  /** By kind: read, created, updated, unchanged, skipped, failed. */
  counts: model.json().default({}),
  finished_at: model.dateTime().nullable(),
})
