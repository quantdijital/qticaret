import { randomUUID } from "node:crypto"
import { z } from "@medusajs/framework/zod"
import { serverErrorMessage } from "../../../lib/errors/messages"
import { XLSX_MIME, writeXlsx } from "../../../lib/sheets"
import type { SheetCell } from "../../../lib/sheets"
import { AUDIT_LOG_MODULE } from "../../../modules/audit-log"
import type AuditLogModuleService from "../../../modules/audit-log/service"
import { MIGRATION_MODULE } from "../../../modules/migration"
import type MigrationModuleService from "../../../modules/migration/service"
import { applyUrls } from "../../migration/urls-apply"
import type { JobType } from "./types"

const input = z.object({}).strict()

// What each outcome means to the owner; a refusal is the server's sentence for its key
const OUTCOME_TEXT: Readonly<Record<string, string>> = {
  reserved: "Kaydın yeni adresine 301",
  covered: "Zaten yanıt veriyor",
  redirected: "301 kuralı yazıldı",
  gone: "410 kuralı yazıldı",
  undecided: "Karar bekliyor",
  unsupported: "Sorgu dizeli adres: sunucu kuralı gerekir",
}

const PAGE = 1000

/**
 * The old site's addresses applied (F14.7, adr/0042 §8): queued by
 * `POST /admin/migrations/urls/apply`, the owner's alone. It writes the
 * URL registry and redirect rules, so it runs apart from a migration or
 * an import. The report lists every address with what was done with it.
 */
export const migrationUrls: JobType<z.infer<typeof input>> = {
  input,
  singleton: true,
  group: "catalog.write",
  resultTtlDays: 7,
  containsPersonalData: false,
  privateToAsker: true,
  internal: true,
  execute: async ({ container, job, progress, resultFile }) => {
    const counts = await applyUrls(container, (done, total) =>
      progress(total > 0 ? (done / total) * 90 : 90)
    )
    await container.resolve<AuditLogModuleService>(AUDIT_LOG_MODULE).record({
      kind: "system",
      action: "migration.urls_applied",
      actor_type: job.requested_by ? "user" : "system",
      actor_id: job.requested_by,
      resource_type: "async_job",
      resource_id: job.id,
      changes: { ...counts },
    })
    const migration = container.resolve<MigrationModuleService>(MIGRATION_MODULE)
    const rows: SheetCell[][] = [["Eski adres", "Tıklama", "Sonuç"]]
    for (let skip = 0; ; skip += PAGE) {
      const page = await migration.listMigrationUrls(
        {},
        { select: ["address", "clicks", "outcome"], skip, take: PAGE, order: { clicks: "DESC" } }
      )
      for (const row of page) {
        const outcome = row.outcome ?? ""
        rows.push([
          row.address,
          row.clicks,
          OUTCOME_TEXT[outcome] ?? serverErrorMessage(outcome, "tr"),
        ])
      }
      if (page.length < PAGE) {
        break
      }
    }
    const file = await resultFile(`adres-raporu-${randomUUID()}.xlsx`, XLSX_MIME)
    for await (const chunk of writeXlsx([{ name: "Adresler", widths: [60, 10, 50], rows }])) {
      await file.write(chunk as Buffer)
    }
    return { summary: { counts } }
  },
}
