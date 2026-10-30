import { createHash, randomUUID } from "node:crypto"
import { Modules } from "@medusajs/framework/utils"
import { z } from "@medusajs/framework/zod"
import { errorSummary, logger } from "../../../lib/logging"
import { bundleSource } from "../../../lib/migration/sources/bundle"
import { XLSX_MIME, writeXlsx } from "../../../lib/sheets"
import { AUDIT_LOG_MODULE } from "../../../modules/audit-log"
import type AuditLogModuleService from "../../../modules/audit-log/service"
import { MIGRATION_MODULE } from "../../../modules/migration"
import type MigrationModuleService from "../../../modules/migration/service"
import { reportSheets } from "../../migration/report"
import { runMigration } from "../../migration/run"
import type { JobType } from "./types"

/** The name an uploaded migration file is stored under; the job reads no other file. */
export const MIGRATION_FILE_PREFIX = "migration-bundle-"

const input = z
  .object({
    source: z.literal("bundle"),
    source_file_id: z
      .string()
      .min(1)
      .max(512)
      .refine((id) => id.includes(MIGRATION_FILE_PREFIX)),
    mode: z.enum(["check", "apply"]),
    // The owner's parcel for a product without measurements: grams and cm
    defaults: z
      .object({
        weight: z.number().positive().max(1_000_000),
        length: z.number().positive().max(10_000),
        width: z.number().positive().max(10_000),
        height: z.number().positive().max(10_000),
      })
      .strict()
      .nullable()
      .default(null),
  })
  .strict()

/**
 * A shop's old platform moved here, or a dry run of it (F14, adr/0042 §9):
 * queued by `POST /admin/migrations` with the file it stored, never through
 * the generic jobs route. It writes products, so it runs apart from an
 * import or a bulk edit. The file holds the shop's customers: it is
 * deleted however the run ends, and the job and its report are the
 * owner's. A run is kept with its counts as each kind ends; applying is
 * in the audit log as it starts and ends.
 */
export const migrationRun: JobType<z.infer<typeof input>> = {
  input,
  singleton: true,
  group: "catalog.write",
  resultTtlDays: 7,
  // The report names source records by their keys, and a source may key customers by e-mail
  containsPersonalData: true,
  privateToAsker: true,
  internal: true,
  execute: async (
    { container, job, progress, resultFile },
    { source, source_file_id, mode, defaults }
  ) => {
    const files = container.resolve(Modules.FILE)
    const migration = container.resolve<MigrationModuleService>(MIGRATION_MODULE)
    const audit = container.resolve<AuditLogModuleService>(AUDIT_LOG_MODULE)
    const run = await migration.createMigrationRuns({
      source,
      mode,
      job_id: job.id,
      started_by: job.requested_by,
    })
    try {
      const buffer = await files.getAsBuffer(source_file_id)
      const digest = createHash("sha256").update(buffer).digest("hex")
      const record = async (action: string, changes: Record<string, unknown>) => {
        await audit.record({
          kind: "system",
          action: `migration.${action}`,
          actor_type: job.requested_by ? "user" : "system",
          actor_id: job.requested_by,
          resource_type: "async_job",
          resource_id: job.id,
          changes: { ...changes, file_sha256: digest },
        })
      }
      if (mode === "apply") {
        await record("started", { source, run_id: run.id })
      }
      const { counts, productRows, problems } = await runMigration(
        container,
        bundleSource(buffer),
        run.id,
        mode,
        defaults,
        {
          progress: (percent) => progress(percent),
          origin: { job_id: job.id, actor_id: job.requested_by },
          audit: (action, changes) =>
            mode === "apply" ? record(action, changes) : Promise.resolve(),
        }
      )
      if (mode === "apply") {
        await record("finished", { run_id: run.id, counts })
      }
      const file = await resultFile(`gecis-rapor-${randomUUID()}.xlsx`, XLSX_MIME)
      for await (const chunk of writeXlsx(reportSheets(mode, counts, productRows, problems))) {
        await file.write(chunk as Buffer)
      }
      await migration.updateMigrationRuns({ id: run.id, status: "done", finished_at: new Date() })
      return { summary: { run_id: run.id, mode, counts } }
    } catch (error) {
      await migration
        .updateMigrationRuns({ id: run.id, status: "failed", finished_at: new Date() })
        .catch(() => undefined)
      throw error
    } finally {
      await files.deleteFiles(source_file_id).catch((error: unknown) => {
        logger.warn({
          event: "migration.source_kept",
          jobId: job.id,
          err: errorSummary(error),
        })
      })
    }
  },
}
