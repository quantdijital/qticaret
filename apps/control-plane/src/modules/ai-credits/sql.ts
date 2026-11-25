import { MedusaError, generateEntityId } from "@medusajs/framework/utils"
import type { AiCreditBucket, AiCreditEntryKind } from "./models/entry"

/** The transaction's connection as the module's raw statements use it. */
export interface Executor {
  execute: (sql: string, params: unknown[]) => Promise<unknown>
}

export const rowsOf = async <T>(manager: Executor, sql: string, params: unknown[]): Promise<T[]> =>
  (await manager.execute(sql, params)) as T[]

/** The clock a wallet's change runs on (adr/0085 §1: the month's roll is lazy). */
export interface WalletClock {
  now: Date
  /**
   * The shop's monthly grant (`ai_free_credits_per_month`), read by the
   * caller when the wallet's month may be behind; null when not read: a
   * wallet whose month is behind then answers `STALE` and nothing changes.
   */
  grant: number | null
}

/** A wallet's month is behind and the caller did not bring the grant: call again with it. */
export const STALE = Object.freeze({ kind: "stale" as const })
export type Stale = typeof STALE

export const isStale = (value: unknown): value is Stale => value === STALE

export interface EntryRow {
  tenantId: string
  kind: AiCreditEntryKind
  amount: number
  bucket: AiCreditBucket
  operationId?: string | null
  grantRef?: string | null
  note?: string | null
  actor: string
  at: Date
}

/** A whole number of credits within a Postgres integer; anything else is a programming error. */
export function wholeCredits(value: number, min = 0): number {
  if (!Number.isSafeInteger(value) || value < min || value > 2_147_483_647) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, "cp.ai_credit_amount_invalid")
  }
  return value
}

/** Ledger rows written in the caller's transaction; a row of 0 credits is not written. */
export async function addEntries(manager: Executor, rows: readonly EntryRow[]): Promise<string[]> {
  const kept = rows.filter((row) => row.amount !== 0)
  if (kept.length === 0) {
    return []
  }
  const ids = kept.map(() => generateEntityId(undefined, "aient"))
  const values = kept.map(() => "(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").join(", ")
  const params = kept.flatMap((row, index) => [
    ids[index],
    row.tenantId,
    row.kind,
    row.amount,
    row.bucket,
    row.operationId ?? null,
    row.grantRef ?? null,
    row.note ?? null,
    row.actor,
    row.at,
    row.at,
  ])
  await manager.execute(
    `INSERT INTO ai_credit_entry
       (id, tenant_id, kind, amount, bucket, operation_id, grant_ref, note, actor, created_at, updated_at)
     VALUES ${values}`,
    params
  )
  return ids
}
