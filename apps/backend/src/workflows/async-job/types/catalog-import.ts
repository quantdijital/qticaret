import { createHash, randomUUID } from "node:crypto"
import { Modules } from "@medusajs/framework/utils"
import { z } from "@medusajs/framework/zod"
import { errorSummary, logger } from "../../../lib/logging"
import { XLSX_MIME, writeXlsx } from "../../../lib/sheets"
import { AUDIT_LOG_MODULE } from "../../../modules/audit-log"
import type AuditLogModuleService from "../../../modules/audit-log/service"
import { REPORT_HEADER, REPORT_WIDTHS } from "../../catalog/import/report"
import { runImport } from "../../catalog/import/run"
import type { JobType } from "./types"

/** The name an uploaded sheet is stored under; the job reads no other file. */
export const IMPORT_FILE_PREFIX = "catalog-import-"

const input = z
  .object({
    source_file_id: z
      .string()
      .min(1)
      .max(512)
      .refine((id) => id.includes(IMPORT_FILE_PREFIX)),
    mode: z.enum(["check", "apply"]),
  })
  .strict()

/**
 * A product sheet checked, or applied (F3.9, adr/0018): queued by
 * `POST /admin/catalog/imports` with the file it stored, never through the
 * generic jobs route. The report is an xlsx of the file's rows; the sheet
 * is deleted however the run ends. Applying is in the audit log as it
 * starts (the file's digest, what it would do) and as it ends (what it
 * wrote, by handle), so a run that fails half-way still says so.
 */
export const catalogImport: JobType<z.infer<typeof input>> = {
  input,
  singleton: true,
  resultTtlDays: 7,
  containsPersonalData: false,
  internal: true,
  execute: async ({ container, job, progress, resultFile }, { source_file_id, mode }) => {
    const files = container.resolve(Modules.FILE)
    try {
      const buffer = await files.getAsBuffer(source_file_id)
      const digest = createHash("sha256").update(buffer).digest("hex")
      const audit = container.resolve<AuditLogModuleService>(AUDIT_LOG_MODULE)
      const { summary, rows } = await runImport(container, buffer, mode, {
        progress: (percent) => progress(percent),
        origin: { job_id: job.id, actor_id: job.requested_by },
        audit: async (action, changes) => {
          await audit.record({
            kind: "system",
            action: `catalog.import_${action}`,
            actor_type: job.requested_by ? "user" : "system",
            actor_id: job.requested_by,
            resource_type: "async_job",
            resource_id: job.id,
            changes: { ...changes, file_sha256: digest },
          })
        },
      })
      const file = await resultFile(`katalog-rapor-${randomUUID()}.xlsx`, XLSX_MIME)
      for await (const chunk of writeXlsx([
        { name: "Sonuç", widths: REPORT_WIDTHS, rows: [[...REPORT_HEADER], ...rows] },
      ])) {
        await file.write(chunk as Buffer)
      }
      return { summary: { ...summary } }
    } finally {
      await files.deleteFiles(source_file_id).catch((error: unknown) => {
        logger.warn({
          event: "catalog.import_source_kept",
          jobId: job.id,
          err: errorSummary(error),
        })
      })
    }
  },
}
