import { randomUUID } from "node:crypto"
import { z } from "@medusajs/framework/zod"
import { CSV_BOM, toCsv } from "../../../lib/security"
import { AUDIT_LOG_MODULE } from "../../../modules/audit-log"
import { AUDIT_ACTOR_TYPES } from "../../../modules/audit-log/service"
import type AuditLogModuleService from "../../../modules/audit-log/service"
import { SHOP_ENTRIES } from "../../../modules/audit-log/shop-view"
import type { JobType } from "./types"

const PAGE = 1_000
// A bigger export is cut here and says so in its summary
export const MAX_EXPORT_ROWS = 50_000
// One change set can be 64 KB (adr/0011); a cell this long says it was cut
const MAX_CHANGES_CELL = 8_192

const text = z.string().trim().min(1).max(256)

const input = z
  .object({
    kind: z.enum(["mutation", "sensitive_read", "system"]).optional(),
    resource_type: text.optional(),
    resource_id: text.optional(),
    actor_id: text.optional(),
    actor_type: z.enum(AUDIT_ACTOR_TYPES).optional(),
    created_after: z.iso.datetime().optional(),
    created_before: z.iso.datetime().optional(),
  })
  .strict()

const COLUMNS = [
  "id",
  "created_at",
  "kind",
  "action",
  "actor_type",
  "actor_id",
  "resource_type",
  "resource_id",
  "outcome",
  "request_id",
  "ip",
  "user_agent",
  "changes",
] as const

function changesCell(changes: unknown, cut: { count: number }): string {
  const json = changes === null || changes === undefined ? "" : JSON.stringify(changes)
  if (json.length <= MAX_CHANGES_CELL) {
    return json
  }
  cut.count += 1
  return `${json.slice(0, MAX_CHANGES_CELL)}…`
}

/**
 * The audit log as CSV (adr/0011, adr/0014): `;`-separated with a BOM for
 * Turkish Excel, every cell escaped against formulas (F2.9), written page by
 * page. Entries are read up to the job's start, so rows written meanwhile
 * do not shift the pages. It holds IPs, so downloading it is recorded.
 */
export const auditLogExport: JobType<z.infer<typeof input>> = {
  input,
  singleton: true,
  resultTtlDays: 7,
  containsPersonalData: true,
  // Whom the log was searched for is no one else's business, that person's least
  privateToAsker: true,
  execute: async ({ container, job, progress, resultFile }, filters) => {
    const service = container.resolve<AuditLogModuleService>(AUDIT_LOG_MODULE)
    const { created_after, created_before, ...fields } = filters
    const until = created_before ? new Date(created_before) : new Date(job.started_at ?? Date.now())
    const where = {
      ...fields,
      created_at: { ...(created_after ? { $gte: new Date(created_after) } : {}), $lte: until },
      // As the viewer: the platform operator's entries are not the shop's (docs/06 principle 10)
      $and: [SHOP_ENTRIES],
    }
    // Unguessable: the dev bucket is readable by URL (adr/0006)
    const file = await resultFile(`audit-log-${randomUUID()}.csv`, "text/csv")
    await file.write(CSV_BOM + toCsv([[...COLUMNS]], ";"))
    const cut = { count: 0 }
    let rows = 0
    let total = 0
    for (let skip = 0; skip < MAX_EXPORT_ROWS; skip += PAGE) {
      const [entries, count] = await service.listAndCountAuditEntries(where, {
        order: { created_at: "DESC", id: "DESC" },
        skip,
        take: Math.min(PAGE, MAX_EXPORT_ROWS - skip),
        withDeleted: true,
      })
      total = skip === 0 ? count : total
      const page = entries.map((entry) =>
        COLUMNS.map((column) =>
          column === "changes"
            ? changesCell(entry.changes, cut)
            : (entry as Record<string, unknown>)[column]
        )
      )
      await file.write(toCsv(page, ";"))
      rows += page.length
      await progress((rows / Math.max(1, Math.min(total, MAX_EXPORT_ROWS))) * 100)
      if (entries.length < PAGE) {
        break
      }
    }
    return { summary: { rows, total, truncated: total > rows, cells_cut: cut.count } }
  },
}
