import { MedusaError, generateEntityId } from "@medusajs/framework/utils"
import type { AiCreditBucket, AiCreditEntryKind } from "./models/entry"
import { AI_DAILY_CAP_DEFAULT, AI_PURCHASED_LIFETIME_MONTHS } from "../../lib/ai-credits/settings"

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

/** Thrown inside a transaction whose wallet's month is behind, to roll it back; the caller retries. */
export class StaleWallet extends Error {
  constructor() {
    super("cp.ai_credit_wallet_stale")
    this.name = "StaleWallet"
  }
}

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

/** The platform's values a wallet's change reads (adr/0085 K6, K7). */
export interface PlatformValues {
  dailyCap: number
  lifetimeMonths: number
}

/**
 * The day's cap and the bought credits' life as the owner set them, read
 * on the change's own connection (so inside its transaction); the
 * defaults while none were saved.
 */
export async function platformValues(manager: Executor): Promise<PlatformValues> {
  const [row] = await rowsOf<{ daily_cap: number; purchased_lifetime_months: number }>(
    manager,
    `SELECT daily_cap, purchased_lifetime_months FROM ai_credit_setting
      WHERE key = 'platform' AND deleted_at IS NULL`,
    []
  )
  return {
    dailyCap: row?.daily_cap ?? AI_DAILY_CAP_DEFAULT,
    lifetimeMonths: row?.purchased_lifetime_months ?? AI_PURCHASED_LIFETIME_MONTHS,
  }
}

/** A whole number of credits within a Postgres integer; anything else is a programming error. */
export function wholeCredits(value: number, min = 0): number {
  if (!Number.isSafeInteger(value) || value < min || value > 2_147_483_647) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, "cp.ai_credit_amount_invalid")
  }
  return value
}

export interface GrantEntryRow {
  tenantId: string
  kind: "grant_purchase" | "adjust"
  amount: number
  bucket: AiCreditBucket
  /** Names the move once (unique among the ledger's rows). */
  grantRef: string
  note: string | null
  actor: string
  at: Date
}

/**
 * A ledger row named by its `grant_ref`, written once in the caller's
 * transaction (the unique index decides, also for two at once): its id
 * and `applied: true`, or the row already written and `applied: false`.
 * A row already there for another shop, kind, bucket or amount is not
 * this move: `cp.ai_credit_grant_ref_conflict`, and nothing is written.
 */
export async function addGrantEntry(
  manager: Executor,
  row: GrantEntryRow
): Promise<{ id: string; applied: boolean }> {
  const [written] = await rowsOf<{ id: string }>(
    manager,
    `INSERT INTO ai_credit_entry
       (id, tenant_id, kind, amount, bucket, grant_ref, note, actor, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT (grant_ref) WHERE grant_ref IS NOT NULL AND deleted_at IS NULL DO NOTHING
     RETURNING id`,
    [
      generateEntityId(undefined, "aient"),
      row.tenantId,
      row.kind,
      row.amount,
      row.bucket,
      row.grantRef,
      row.note,
      row.actor,
      row.at,
      row.at,
    ]
  )
  if (written) {
    return { id: written.id, applied: true }
  }
  const [existing] = await rowsOf<{
    id: string
    tenant_id: string
    kind: string
    amount: number
    bucket: string
  }>(
    manager,
    `SELECT id, tenant_id, kind, amount, bucket FROM ai_credit_entry
      WHERE grant_ref = ? AND deleted_at IS NULL`,
    [row.grantRef]
  )
  if (
    existing?.tenant_id !== row.tenantId ||
    existing.kind !== row.kind ||
    existing.amount !== row.amount ||
    existing.bucket !== row.bucket
  ) {
    throw new MedusaError(MedusaError.Types.CONFLICT, "cp.ai_credit_grant_ref_conflict")
  }
  return { id: existing.id, applied: false }
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
