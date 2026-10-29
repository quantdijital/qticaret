import type { Context } from "@medusajs/framework/types"
import {
  InjectManager,
  InjectTransactionManager,
  MedusaContext,
  MedusaService,
  generateEntityId,
} from "@medusajs/framework/utils"
import { AccountingSync } from "./models/accounting-sync"
import type { SYNC_SOURCES, SYNC_STATUSES } from "./models/accounting-sync"

export type SyncSource = (typeof SYNC_SOURCES)[number]
export type SyncStatus = (typeof SYNC_STATUSES)[number]

export interface ClaimedSync {
  id: string
  adapter: string
  source_type: SyncSource
  source_id: string
  attempts: number
  /** Until when this claim holds it: a mark of a claim another worker has since taken is refused. */
  lease: Date
}

interface Executor {
  execute: (sql: string, params: unknown[]) => Promise<unknown>
}

/** Tries before a record stops and staff are told. */
export const MAX_ATTEMPTS = 8
// Minutes to wait after each failed try: 1, 5, 15 minutes, then 1, 3, 6, 12 hours
const BACKOFF_MINUTES = [1, 5, 15, 60, 180, 360, 720]
// While a claimed record is being sent, no other worker takes it
const LEASE_MINUTES = 10

const minutesFrom = (now: Date, minutes: number) => new Date(now.getTime() + minutes * 60_000)

/** Records sent to the shop's accounting program (F11.5): queued once, sent until they go through. */
class AccountingModuleService extends MedusaService({ AccountingSync }) {
  /**
   * Queues records for a program; one already queued (any status) is left
   * as it is, so an event delivered twice queues one record.
   */
  @InjectTransactionManager()
  async enqueue(
    adapter: string,
    records: readonly { source_type: SyncSource; source_id: string }[],
    @MedusaContext() sharedContext: Context = {}
  ): Promise<number> {
    if (records.length === 0) {
      return 0
    }
    const manager = sharedContext.transactionManager as Executor
    const values = records.map(() => "(?, ?, ?, ?, 'pending', 0, now(), now(), now())").join(", ")
    const rows = (await manager.execute(
      `INSERT INTO accounting_sync
         (id, adapter, source_type, source_id, status, attempts, next_attempt_at, created_at, updated_at)
       VALUES ${values}
       ON CONFLICT (source_type, source_id, adapter) WHERE deleted_at IS NULL DO NOTHING
       RETURNING id`,
      records.flatMap((record) => [
        generateEntityId(undefined, "acsync"),
        adapter,
        record.source_type,
        record.source_id,
      ])
    )) as unknown[]
    return rows.length
  }

  /**
   * Takes up to `limit` records due now for a program, in one statement:
   * two workers never take the same one. A taken record is due again only
   * after the lease, should its worker die halfway.
   */
  @InjectTransactionManager()
  async claimDue(
    adapter: string,
    limit: number,
    now: Date = new Date(),
    @MedusaContext() sharedContext: Context = {}
  ): Promise<ClaimedSync[]> {
    const manager = sharedContext.transactionManager as Executor
    return (await manager.execute(
      `UPDATE accounting_sync SET next_attempt_at = ?, updated_at = now()
        WHERE id IN (
          SELECT id FROM accounting_sync
           WHERE adapter = ? AND status = 'pending' AND next_attempt_at <= ? AND deleted_at IS NULL
           ORDER BY next_attempt_at, id LIMIT ?
           FOR UPDATE SKIP LOCKED)
        RETURNING id, adapter, source_type, source_id, attempts, next_attempt_at AS lease`,
      [minutesFrom(now, LEASE_MINUTES), adapter, now, limit]
    )) as ClaimedSync[]
  }

  /**
   * Leaves a claimed record as `changes` say, only while the claim holds:
   * a worker whose lease ran out (and whose record another worker took)
   * changes nothing. Whether it did.
   */
  @InjectTransactionManager()
  private async settle(
    row: ClaimedSync,
    changes: {
      status: SyncStatus
      attempts: number
      next_attempt_at: Date
      external_ref: string | null
      last_error: string | null
      synced_at: Date | null
    },
    @MedusaContext() sharedContext: Context = {}
  ): Promise<boolean> {
    const manager = sharedContext.transactionManager as Executor
    const rows = (await manager.execute(
      `UPDATE accounting_sync
          SET status = ?, attempts = ?, next_attempt_at = ?, external_ref = ?, last_error = ?,
              synced_at = ?, updated_at = now()
        WHERE id = ? AND status = 'pending' AND next_attempt_at = ? AND deleted_at IS NULL
       RETURNING id`,
      [
        changes.status,
        changes.attempts,
        changes.next_attempt_at,
        changes.external_ref,
        changes.last_error,
        changes.synced_at,
        row.id,
        row.lease,
      ]
    )) as unknown[]
    return rows.length > 0
  }

  /** Sent: the program's id kept. False when the claim had run out. */
  markSynced(row: ClaimedSync, externalRef: string, now: Date = new Date()): Promise<boolean> {
    return this.settle(row, {
      status: "synced",
      attempts: row.attempts,
      next_attempt_at: now,
      external_ref: externalRef,
      last_error: null,
      synced_at: now,
    })
  }

  /** Nothing to send, for `code`'s reason. False when the claim had run out. */
  markSkipped(row: ClaimedSync, code: string, now: Date = new Date()): Promise<boolean> {
    return this.settle(row, {
      status: "skipped",
      attempts: row.attempts,
      next_attempt_at: now,
      external_ref: null,
      last_error: code.slice(0, 120),
      synced_at: null,
    })
  }

  /**
   * One more failed try: later again, or stopped after the last; the
   * status it is left in, or null when the claim had run out.
   */
  async markFailed(
    row: ClaimedSync,
    code: string,
    now: Date = new Date()
  ): Promise<SyncStatus | null> {
    const tried = row.attempts + 1
    const status = tried >= MAX_ATTEMPTS ? "stopped" : "pending"
    const done = await this.settle(row, {
      status,
      attempts: tried,
      next_attempt_at: minutesFrom(now, BACKOFF_MINUTES[tried - 1] ?? 720),
      external_ref: null,
      last_error: code.slice(0, 120),
      synced_at: null,
    })
    return done ? status : null
  }

  /** A program's record of a source: how far it went, and its id there. */
  async recordOf(adapter: string, sourceType: SyncSource, sourceId: string) {
    const [row] = await this.listAccountingSyncs(
      { adapter, source_type: sourceType, source_id: sourceId },
      { select: ["id", "status", "external_ref"], take: 1 }
    )
    return row ?? null
  }

  /** Staff ask a stopped record to be tried again, from the start. */
  async retry(id: string, now: Date = new Date()): Promise<boolean> {
    const [row] = await this.listAccountingSyncs({ id, status: "stopped" }, { take: 1 })
    if (!row) {
      return false
    }
    await this.updateAccountingSyncs({ id, status: "pending", attempts: 0, next_attempt_at: now })
    return true
  }

  /**
   * When the first record for a program was queued: its books start there,
   * and a sweep never reaches before it (what came before the shop picked
   * the program is not sent). Null while nothing is queued.
   */
  @InjectManager()
  async firstQueuedAt(
    adapter: string,
    @MedusaContext() sharedContext: Context = {}
  ): Promise<Date | null> {
    const manager = sharedContext.manager as Executor
    const [row] = (await manager.execute(
      `SELECT min(created_at) AS first FROM accounting_sync WHERE adapter = ? AND deleted_at IS NULL`,
      [adapter]
    )) as { first: Date | null }[]
    return row?.first ? new Date(row.first) : null
  }

  /** How many records are in each state, for a program. */
  @InjectManager()
  async counts(
    adapter: string,
    @MedusaContext() sharedContext: Context = {}
  ): Promise<Record<SyncStatus, number>> {
    const manager = sharedContext.manager as Executor
    const rows = (await manager.execute(
      `SELECT status, count(*)::integer AS count FROM accounting_sync
        WHERE adapter = ? AND deleted_at IS NULL GROUP BY status`,
      [adapter]
    )) as { status: SyncStatus; count: number }[]
    const counts: Record<SyncStatus, number> = { pending: 0, synced: 0, stopped: 0, skipped: 0 }
    for (const row of rows) {
      counts[row.status] = row.count
    }
    return counts
  }
}

export default AccountingModuleService
