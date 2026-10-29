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
        RETURNING id, adapter, source_type, source_id, attempts`,
      [minutesFrom(now, LEASE_MINUTES), adapter, now, limit]
    )) as ClaimedSync[]
  }

  async markSynced(id: string, externalRef: string, now: Date = new Date()): Promise<void> {
    await this.updateAccountingSyncs({
      id,
      status: "synced",
      external_ref: externalRef,
      last_error: null,
      synced_at: now,
    })
  }

  /** One more failed try: later again, or stopped after the last; the status it is left in. */
  async markFailed(
    id: string,
    attempts: number,
    code: string,
    now: Date = new Date()
  ): Promise<SyncStatus> {
    const tried = attempts + 1
    const stopped = tried >= MAX_ATTEMPTS
    await this.updateAccountingSyncs({
      id,
      attempts: tried,
      last_error: code.slice(0, 120),
      status: stopped ? "stopped" : "pending",
      next_attempt_at: minutesFrom(now, BACKOFF_MINUTES[tried - 1] ?? 720),
    })
    return stopped ? "stopped" : "pending"
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
    const counts: Record<SyncStatus, number> = { pending: 0, synced: 0, stopped: 0 }
    for (const row of rows) {
      counts[row.status] = row.count
    }
    return counts
  }
}

export default AccountingModuleService
