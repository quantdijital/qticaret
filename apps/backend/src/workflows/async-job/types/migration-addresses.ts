import { z } from "@medusajs/framework/zod"
import { AUDIT_LOG_MODULE } from "../../../modules/audit-log"
import type AuditLogModuleService from "../../../modules/audit-log/service"
import { MIGRATION_MODULE } from "../../../modules/migration"
import type MigrationModuleService from "../../../modules/migration/service"
import { inventoryFromItems } from "../../migration/urls"
import { reserveRecordPaths } from "../../migration/urls-apply"
import type { JobType } from "./types"

const input = z.object({}).strict()

/**
 * "Yönlendirmeleri yeniden oluştur" (adr/0042 Ek 2026-11-27): every moved
 * record's old address taken into the inventory again (one a run left out
 * or a decision undid) and its path kept for the record (a 301 to its new
 * page). The owner's own 301s, 410s and decisions are not touched: they
 * wait for "Kararları uygula". Queued by `POST /admin/migrations/urls/rebuild`,
 * the owner's alone; safe to run again.
 */
export const migrationAddresses: JobType<z.infer<typeof input>> = {
  input,
  singleton: true,
  group: "catalog.write",
  resultTtlDays: 7,
  containsPersonalData: false,
  ownerOnly: true,
  internal: true,
  execute: async ({ container, job, progress }) => {
    const migration = container.resolve<MigrationModuleService>(MIGRATION_MODULE)
    const { sources } = await migration.tallies()
    let read = 0
    for (const [index, source] of sources.entries()) {
      await progress((index / Math.max(sources.length, 1)) * 60)
      read += await inventoryFromItems(container, source)
    }
    await progress(60)
    const kept = await reserveRecordPaths(container)
    const counts = { sources: sources.length, read, ...kept }
    await container.resolve<AuditLogModuleService>(AUDIT_LOG_MODULE).record({
      kind: "system",
      action: "migration.addresses_rebuilt",
      actor_type: job.requested_by ? "user" : "system",
      actor_id: job.requested_by,
      resource_type: "async_job",
      resource_id: job.id,
      changes: counts,
    })
    return { summary: { counts } }
  },
}
