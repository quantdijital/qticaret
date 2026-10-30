import { z } from "@medusajs/framework/zod"
import { AUDIT_LOG_MODULE } from "../../../modules/audit-log"
import type AuditLogModuleService from "../../../modules/audit-log/service"
import { MIGRATION_MODULE } from "../../../modules/migration"
import type MigrationModuleService from "../../../modules/migration/service"
import { sendInvites } from "../../migration/invites"
import type { JobType } from "./types"

const input = z.object({}).strict()

/**
 * The moved customers asked to open their accounts (F14.5, adr/0042 §6):
 * queued by `POST /admin/migrations/invites`, the owner's alone. Every
 * moved customer joins the queue; today's share goes now, the rest each
 * morning (`migration-invites`). In the audit log: it mails the shop's
 * customers.
 */
export const migrationInvites: JobType<z.infer<typeof input>> = {
  input,
  singleton: true,
  resultTtlDays: 1,
  containsPersonalData: false,
  privateToAsker: true,
  internal: true,
  execute: async ({ container, job, progress }) => {
    const queued = await container.resolve<MigrationModuleService>(MIGRATION_MODULE).queueInvites()
    await progress(10)
    const today = await sendInvites(container)
    await container.resolve<AuditLogModuleService>(AUDIT_LOG_MODULE).record({
      kind: "system",
      action: "migration.invites_started",
      actor_type: job.requested_by ? "user" : "system",
      actor_id: job.requested_by,
      resource_type: "async_job",
      resource_id: job.id,
      changes: { queued, ...today },
    })
    return { summary: { queued, ...today } }
  },
}
