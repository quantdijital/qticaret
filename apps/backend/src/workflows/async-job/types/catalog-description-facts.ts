import { randomUUID } from "node:crypto"
import { XLSX_MIME, writeXlsx } from "../../../lib/sheets"
import { AUDIT_LOG_MODULE } from "../../../modules/audit-log"
import type AuditLogModuleService from "../../../modules/audit-log/service"
import { FactsApplyInput } from "../../product-attributes/facts/input"
import { FACTS_REPORT_HEADER, FACTS_REPORT_WIDTHS } from "../../product-attributes/facts/report"
import { runDescriptionFacts } from "../../product-attributes/facts/run"
import type { JobType } from "./types"

/**
 * The facts in the selected products' descriptions written to their
 * attribute values (adr/0013 Ek 2026-11-05), as the panel's preview showed
 * them. In the audit log as it starts, for each template it adds fields or
 * names to, for each product it writes (each value before and after) and
 * as it ends. The report is an xlsx, a row per product named.
 */
export const catalogDescriptionFacts: JobType<FactsApplyInput> = {
  input: FactsApplyInput,
  singleton: true,
  // It writes products' values: never beside an import or a bulk edit
  group: "catalog.write",
  resultTtlDays: 7,
  containsPersonalData: false,
  execute: async ({ container, job, progress, resultFile }, input) => {
    const audit = container.resolve<AuditLogModuleService>(AUDIT_LOG_MODULE)
    const actor = {
      actor_type: job.requested_by ? "user" : "system",
      actor_id: job.requested_by,
    }
    const { summary, rows } = await runDescriptionFacts(container, input, {
      progress: (percent) => progress(percent),
      audit: async (action, changes) => {
        await audit.record({
          ...actor,
          kind: "system",
          action: `catalog.description_facts_${action}`,
          resource_type: "async_job",
          resource_id: job.id,
          changes,
        })
      },
      auditProduct: async (productId, changes) => {
        await audit.record({
          ...actor,
          kind: "system",
          action: "catalog.description_facts_product",
          resource_type: "product",
          resource_id: productId,
          changes: { job_id: job.id, ...changes },
        })
      },
    })
    const file = await resultFile(`aciklama-ozellikleri-${randomUUID()}.xlsx`, XLSX_MIME)
    for await (const chunk of writeXlsx([
      { name: "Sonuç", widths: FACTS_REPORT_WIDTHS, rows: [FACTS_REPORT_HEADER, ...rows] },
    ])) {
      await file.write(chunk as Buffer)
    }
    return { summary: { ...summary } }
  },
}
