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
 * In the audit log as it starts (the change, how many products), for each
 * product it writes (each field before and after) and as it ends (the
 * products changed). The report is an xlsx, a row per product named.
 */
export const catalogBulkEdit: JobType<BulkEditInput> = {
  input: BulkEditInput,
  singleton: true,
  // Both write products: an import and a bulk edit never run side by side
  group: "catalog.write",
  resultTtlDays: 7,
  containsPersonalData: false,
  execute: async ({ container, job, progress, resultFile }, input) => {
    const audit = container.resolve<AuditLogModuleService>(AUDIT_LOG_MODULE)
    const actor = {
      actor_type: job.requested_by ? "user" : "system",
      actor_id: job.requested_by,
    }
    const { summary, rows } = await runBulkEdit(container, input, {
      progress: (percent) => progress(percent),
      origin: { job_id: job.id, actor_id: job.requested_by },
      audit: async (action, changes) => {
        await audit.record({
          ...actor,
          kind: "system",
          action: `catalog.bulk_edit_${action}`,
          resource_type: "async_job",
          resource_id: job.id,
          changes,
        })
      },
      // As the product routes record theirs: per product, field by field
      auditProduct: async (productId, diff) => {
        await audit.record({
          ...actor,
          kind: "system",
          action: "catalog.bulk_edit_product",
          resource_type: "product",
          resource_id: productId,
          changes: { job_id: job.id, action: input.change.action, diff },
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
