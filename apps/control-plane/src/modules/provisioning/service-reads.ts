import type { Context } from "@medusajs/framework/types"
import { InjectManager, MedusaContext, MedusaService } from "@medusajs/framework/utils"
import { ProvisioningRun } from "./models/provisioning-run"
import { ProvisioningStep } from "./models/provisioning-step"

interface Reader {
  execute: (sql: string, params: unknown[]) => Promise<unknown>
}

/**
 * A shop's latest backup as its runs recorded it (audit 3.2): the last
 * `backup` step that ended, of a backup run or an upgrade. A success
 * carries the manifest's summary; a failure its code. Nothing else of
 * the manifest is kept here (the backup's folder holds it).
 */
export interface BackupSeen {
  tenant_id: string
  status: "succeeded" | "failed"
  /** When the backup was taken (the manifest's time); a failure: when it failed. */
  at: Date
  bytes: number | null
  files: boolean | null
  error_code: string | null
  run_id: string
}

const placeholders = (values: readonly unknown[]) => values.map(() => "?").join(", ")
// Shops per statement when a list of them is looked up
const CHUNK = 1_000

/** The provisioning module's reads across runs (the run's own reads are the service's). */
export class ProvisioningReads extends MedusaService({ ProvisioningRun, ProvisioningStep }) {
  /** Whether an earlier run mailed the shop's owner invitation (a setup run again sends none). */
  @InjectManager()
  async ownerInvited(
    tenantId: string,
    @MedusaContext() sharedContext: Context = {}
  ): Promise<boolean> {
    const rows = (await (sharedContext.manager as Reader).execute(
      `SELECT 1 FROM provisioning_step s JOIN provisioning_run r ON r.id = s.run_id
        WHERE r.tenant_id = ? AND s.name IN ('owner_invite', 'resend_invite')
          AND s.status = 'succeeded' AND s.output ->> 'mailed' = 'true'
          AND s.deleted_at IS NULL AND r.deleted_at IS NULL
        LIMIT 1`,
      [tenantId]
    )) as unknown[]
    return rows.length > 0
  }

  /** These shops' latest backups (audit 3.2); a shop never backed up is absent. */
  @InjectManager()
  async latestBackups(
    tenantIds: readonly string[],
    @MedusaContext() sharedContext: Context = {}
  ): Promise<Map<string, BackupSeen>> {
    const out = new Map<string, BackupSeen>()
    for (let at = 0; at < tenantIds.length; at += CHUNK) {
      const ids = tenantIds.slice(at, at + CHUNK)
      const rows = (await (sharedContext.manager as Reader).execute(
        `SELECT DISTINCT ON (r.tenant_id) r.tenant_id, r.id AS run_id, s.status, s.error_code,
                s.finished_at, s.output ->> 'taken_at' AS taken_at,
                s.output ->> 'bytes' AS bytes, s.output ->> 'files' AS files
           FROM provisioning_step s JOIN provisioning_run r ON r.id = s.run_id
          WHERE r.tenant_id IN (${placeholders(ids)}) AND s.name = 'backup'
            AND s.status IN ('succeeded', 'failed') AND s.finished_at IS NOT NULL
            AND s.deleted_at IS NULL AND r.deleted_at IS NULL
          ORDER BY r.tenant_id, s.finished_at DESC`,
        [...ids]
      )) as {
        tenant_id: string
        run_id: string
        status: "succeeded" | "failed"
        error_code: string | null
        finished_at: Date
        taken_at: string | null
        bytes: string | null
        files: string | null
      }[]
      for (const row of rows) {
        const ok = row.status === "succeeded"
        out.set(row.tenant_id, {
          tenant_id: row.tenant_id,
          status: row.status,
          at: ok && row.taken_at ? new Date(row.taken_at) : new Date(row.finished_at),
          bytes: ok && row.bytes !== null ? Number(row.bytes) : null,
          files: ok && row.files !== null ? row.files === "true" : null,
          error_code: ok ? null : row.error_code,
          run_id: row.run_id,
        })
      }
    }
    return out
  }
}
