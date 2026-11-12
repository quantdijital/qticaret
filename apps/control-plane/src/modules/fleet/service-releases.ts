import type { Context } from "@medusajs/framework/types"
import {
  InjectManager,
  InjectTransactionManager,
  MedusaContext,
  MedusaError,
} from "@medusajs/framework/utils"
import { FleetMonitoring } from "./service-monitoring"

interface Executor {
  execute: <T = unknown[]>(sql: string, params?: unknown[]) => Promise<T>
}

export interface ReleaseRecord {
  id: string
  version: string
  commit: string
  notes: string | null
  created_by: string | null
  created_at: Date
}

/** A shop's target as stored, with its release (null: none set). */
export interface TargetRecord {
  tenant_id: string
  release: { id: string; version: string; commit: string } | null
  set_by: string | null
  set_at: Date
  reason: string
}

/** What a shop's latest usage report says it runs (Ek C13's snapshot). */
export interface ReportedRelease {
  version: string
  commit: string
  reported_at: Date
  received_at: Date
}

/** A target as it was before a change, for its undo; null: the shop had no row. */
export interface TargetBefore {
  tenant_id: string
  row: {
    target_release_id: string | null
    set_by: string | null
    set_at: Date
    reason: string
  } | null
}

const RELEASE_FIELDS = ["id", "version", "commit", "notes", "created_by", "created_at"] as const
/** The releases listed: newest first; history beyond this many is not shown (F16.6 pages it). */
export const RELEASES_SHOWN = 500
// Shops per statement when a list of them is looked up
const CHUNK = 1_000

const placeholders = (values: readonly unknown[]) => values.map(() => "?").join(", ")

function chunks<T>(values: readonly T[]): T[][] {
  const out: T[][] = []
  for (let at = 0; at < values.length; at += CHUNK) {
    out.push(values.slice(at, at + CHUNK))
  }
  return out
}

const unknownRelease = () => new MedusaError(MedusaError.Types.NOT_FOUND, "cp.release_unknown")

/**
 * A shop being closed is never upgraded: its target does not change. The
 * one read of the tenants module's table (same database, read only), its
 * row shared-locked until the target is written: a status move (`FOR
 * UPDATE`) waits for it, and it for the move.
 */
async function refuseClosedShop(manager: Executor, tenantId: string): Promise<void> {
  const [shop] = await manager.execute<{ status: string }[]>(
    "SELECT status FROM tenant WHERE id = ? AND deleted_at IS NULL FOR SHARE",
    [tenantId]
  )
  if (!shop) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "cp.tenant_unknown")
  }
  if (shop.status === "closing" || shop.status === "closed") {
    throw new MedusaError(MedusaError.Types.CONFLICT, "cp.tenant_closed")
  }
}

/**
 * The fleet module's releases (adr/0061 §2 `release` / `tenant_version`,
 * Ek C18): the releases the platform knows and the one each shop should
 * run. A version is unique (under an advisory lock, the unique index a
 * second guard); a release is never deleted (its undo in a failed create
 * only). What a shop runs is read from its latest usage snapshot.
 */
export class FleetReleases extends FleetMonitoring {
  @InjectManager()
  async releases(@MedusaContext() sharedContext: Context = {}): Promise<ReleaseRecord[]> {
    return await this.listReleases(
      {},
      {
        select: [...RELEASE_FIELDS],
        order: { created_at: "DESC", id: "DESC" },
        take: RELEASES_SHOWN,
      },
      sharedContext
    )
  }

  /** One release, or 404 `cp.release_unknown`. */
  @InjectManager()
  async releaseOf(
    id: string,
    @MedusaContext() sharedContext: Context = {}
  ): Promise<ReleaseRecord> {
    const [found] = await this.listReleases(
      { id },
      { select: [...RELEASE_FIELDS], take: 1 },
      sharedContext
    )
    if (!found) {
      throw unknownRelease()
    }
    return found
  }

  /** A new release; 409 `cp.release_version_taken` when its version is known already. */
  @InjectTransactionManager()
  async addRelease(
    input: { version: string; commit: string; notes: string | null; created_by: string },
    @MedusaContext() sharedContext: Context = {}
  ): Promise<ReleaseRecord> {
    await (sharedContext.transactionManager as Executor).execute(
      "SELECT pg_advisory_xact_lock(hashtext(?))",
      [`release:${input.version}`]
    )
    const [same] = await this.listReleases({ version: input.version }, { take: 1 }, sharedContext)
    if (same) {
      throw new MedusaError(MedusaError.Types.CONFLICT, "cp.release_version_taken")
    }
    const [made] = await this.createReleases([input], sharedContext)
    return await this.releaseOf((made as { id: string }).id, sharedContext)
  }

  /** The undo of `addRelease` in a failed workflow: the row goes for good (it was never seen). */
  @InjectTransactionManager()
  async removeRelease(id: string, @MedusaContext() sharedContext: Context = {}): Promise<void> {
    await (sharedContext.transactionManager as Executor).execute(
      'DELETE FROM "release" WHERE id = ?',
      [id]
    )
  }

  /** A release's note set (null clears it); the note before comes back. */
  @InjectTransactionManager()
  async setReleaseNotes(
    id: string,
    notes: string | null,
    @MedusaContext() sharedContext: Context = {}
  ): Promise<string | null> {
    const before = await this.releaseOf(id, sharedContext)
    await this.updateReleases({ id, notes }, sharedContext)
    return before.notes
  }

  /** The shops each release is the target of (shops with no target are not counted). */
  @InjectManager()
  async targets(
    @MedusaContext() sharedContext: Context = {}
  ): Promise<{ tenant_id: string; release_id: string }[]> {
    return await (sharedContext.manager as Executor).execute<
      { tenant_id: string; release_id: string }[]
    >(
      `SELECT tenant_id, target_release_id AS release_id FROM tenant_version
        WHERE target_release_id IS NOT NULL AND deleted_at IS NULL`,
      []
    )
  }

  /** These shops' targets with their releases (a shop with no row, or none set, is absent). */
  @InjectManager()
  async targetsOf(
    tenantIds: readonly string[],
    @MedusaContext() sharedContext: Context = {}
  ): Promise<Map<string, TargetRecord>> {
    const out = new Map<string, TargetRecord>()
    for (const ids of chunks(tenantIds)) {
      const rows = await (sharedContext.manager as Executor).execute<
        (Omit<TargetRecord, "release"> & {
          release_id: string | null
          version: string | null
          commit: string | null
        })[]
      >(
        `SELECT tv.tenant_id, tv.set_by, tv.set_at, tv.reason, r.id AS release_id, r.version, r.commit
           FROM tenant_version tv
           LEFT JOIN "release" r ON r.id = tv.target_release_id AND r.deleted_at IS NULL
          WHERE tv.deleted_at IS NULL AND tv.tenant_id IN (${placeholders(ids)})`,
        [...ids]
      )
      for (const { release_id, version, commit, ...row } of rows) {
        out.set(row.tenant_id, {
          ...row,
          release: release_id && version && commit ? { id: release_id, version, commit } : null,
        })
      }
    }
    return out
  }

  /**
   * A shop's target set (`release_id` null: none), under the shop's lock;
   * 404 `cp.release_unknown` for a release that is not known, 409
   * `cp.tenant_closed` for a shop being closed (review L2: read in this
   * transaction with the shop's row shared-locked, so a close cannot slip
   * in between). What it was comes back, for the undo and the audit.
   */
  @InjectTransactionManager()
  async setTarget(
    input: { tenant_id: string; release_id: string | null; actor: string; reason: string },
    @MedusaContext() sharedContext: Context = {}
  ): Promise<TargetBefore> {
    const manager = sharedContext.transactionManager as Executor
    await manager.execute("SELECT pg_advisory_xact_lock(hashtext(?))", [
      `tenant_version:${input.tenant_id}`,
    ])
    await refuseClosedShop(manager, input.tenant_id)
    if (input.release_id !== null) {
      await this.releaseOf(input.release_id, sharedContext)
    }
    const [current] = (await this.listTenantVersions(
      { tenant_id: input.tenant_id },
      { select: ["id", "target_release_id", "set_by", "set_at", "reason"], take: 1 },
      sharedContext
    )) as unknown as ({ id: string } & NonNullable<TargetBefore["row"]>)[]
    const fields = {
      target_release_id: input.release_id,
      set_by: input.actor,
      set_at: new Date(),
      reason: input.reason,
    }
    if (current) {
      await this.updateTenantVersions({ id: current.id, ...fields }, sharedContext)
    } else {
      await this.createTenantVersions([{ tenant_id: input.tenant_id, ...fields }], sharedContext)
    }
    const row = current
      ? {
          target_release_id: current.target_release_id,
          set_by: current.set_by,
          set_at: current.set_at,
          reason: current.reason,
        }
      : null
    return { tenant_id: input.tenant_id, row }
  }

  /** The undo of `setTarget`: the row put back as it was, or removed when there was none. */
  @InjectTransactionManager()
  async restoreTarget(before: TargetBefore, @MedusaContext() sharedContext: Context = {}) {
    const manager = sharedContext.transactionManager as Executor
    if (!before.row) {
      await manager.execute("DELETE FROM tenant_version WHERE tenant_id = ?", [before.tenant_id])
      return
    }
    await manager.execute(
      `UPDATE tenant_version SET target_release_id = ?, set_by = ?, set_at = ?, reason = ?,
          updated_at = now() WHERE tenant_id = ? AND deleted_at IS NULL`,
      [
        before.row.target_release_id,
        before.row.set_by,
        before.row.set_at,
        before.row.reason,
        before.tenant_id,
      ]
    )
  }

  /**
   * What these shops' latest usage reports say they run: one index probe
   * a shop (`tenant_id, reported_at`), never a scan of the history.
   */
  @InjectManager()
  async latestReports(
    tenantIds: readonly string[],
    @MedusaContext() sharedContext: Context = {}
  ): Promise<Map<string, ReportedRelease>> {
    const out = new Map<string, ReportedRelease>()
    for (const ids of chunks(tenantIds)) {
      const rows = await (sharedContext.manager as Executor).execute<
        (ReportedRelease & { tenant_id: string })[]
      >(
        `SELECT t.id AS tenant_id, u.release_version AS version, u.release_commit AS commit,
                u.reported_at, u.received_at
           FROM unnest(ARRAY[${placeholders(ids)}]::text[]) AS t(id)
           CROSS JOIN LATERAL (
             SELECT release_version, release_commit, reported_at, received_at FROM usage_snapshot
              WHERE tenant_id = t.id AND deleted_at IS NULL ORDER BY reported_at DESC LIMIT 1
           ) u`,
        [...ids]
      )
      for (const { tenant_id, ...row } of rows) {
        out.set(tenant_id, row)
      }
    }
    return out
  }

  /** A removed shop's target (the e2e cleanup; F16.11's closing). */
  @InjectTransactionManager()
  async forgetTarget(tenantId: string, @MedusaContext() sharedContext: Context = {}) {
    await (sharedContext.transactionManager as Executor).execute(
      "DELETE FROM tenant_version WHERE tenant_id = ?",
      [tenantId]
    )
  }
}
