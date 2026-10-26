import { randomUUID } from "node:crypto"
import { XLSX_MIME, writeXlsx } from "../../../lib/sheets"
import { AUDIT_LOG_MODULE } from "../../../modules/audit-log"
import type AuditLogModuleService from "../../../modules/audit-log/service"
import { BulkEditInput } from "../../catalog/bulk-edit/change"
import { BULK_REPORT_HEADER, BULK_REPORT_WIDTHS } from "../../catalog/bulk-edit/report"
import { runBulkEdit } from "../../catalog/bulk-edit/run"
import type { JobType } from "./types"

/**
 * One change to the products the panel selected (F3.10): a price, stock,
 * status, category, SEO texts back to the templates, or missing alt texts.
 * In the audit log as it starts (the change, how many products) and as it
 * ends (what it changed, by product). The report is an xlsx, a row per
 * product named.
 */
export const catalogBulkEdit: JobType<BulkEditInput> = {
  input: BulkEditInput,
  singleton: true,
  resultTtlDays: 7,
  containsPersonalData: false,
  execute: async ({ container, job, progress, resultFile }, input) => {
    const audit = container.resolve<AuditLogModuleService>(AUDIT_LOG_MODULE)
    const { summary, rows } = await runBulkEdit(container, input, {
      progress: (percent) => progress(percent),
      origin: { job_id: job.id, actor_id: job.requested_by },
      audit: async (action, changes) => {
        await audit.record({
          kind: "system",
          action: `catalog.bulk_edit_${action}`,
          actor_type: job.requested_by ? "user" : "system",
          actor_id: job.requested_by,
          resource_type: "async_job",
          resource_id: job.id,
          changes,
        })
      },
    })
    const file = await resultFile(`toplu-duzenleme-${randomUUID()}.xlsx`, XLSX_MIME)
    for await (const chunk of writeXlsx([
      { name: "Sonuç", widths: BULK_REPORT_WIDTHS, rows: [[...BULK_REPORT_HEADER], ...rows] },
    ])) {
      await file.write(chunk as Buffer)
    }
    return { summary: { ...summary } }
  },
}
