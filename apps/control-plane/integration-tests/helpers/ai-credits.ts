import { randomUUID } from "node:crypto"
import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { plansIn } from "../../src/workflows/modules"

interface Knex {
  raw: (sql: string, params?: unknown[]) => Promise<{ rows: Record<string, unknown>[] }>
}

export const pgOf = (container: MedusaContainer) =>
  container.resolve<Knex>(ContainerRegistrationKeys.PG_CONNECTION)

/** A shop id of the test's own: wallets key by it, no tenant row is needed. */
export const shopId = () => `ten_${randomUUID().replace(/-/g, "").slice(0, 20)}`

export const opId = () => randomUUID()

/** An instant on Istanbul's clock (UTC+3): `istanbul("2026-11-10", "23:30")`. */
export const istanbul = (day: string, time = "12:00") => new Date(`${day}T${time}:00.000+03:00`)

/** The shop's own monthly grant (`ai_free_credits_per_month`), as staff would set it. */
export async function setMonthlyGrant(
  container: MedusaContainer,
  tenantId: string,
  value: number
): Promise<void> {
  await plansIn(container).setOverride(tenantId, "ai_free_credits_per_month", {
    value,
    reason: "test",
    expires_at: null,
    created_by: null,
  })
}

export interface WalletState {
  plan_balance: number
  plan_period: string | null
  purchased_balance: number
  purchased_expires_at: Date | null
  daily_cap: number | null
  spent_today: number
  spent_day: string | null
}

export async function walletOf(
  container: MedusaContainer,
  tenantId: string
): Promise<WalletState | undefined> {
  const { rows } = await pgOf(container).raw(
    `SELECT plan_balance, plan_period, purchased_balance, purchased_expires_at, daily_cap,
            spent_today, spent_day
       FROM ai_credit_wallet WHERE tenant_id = ?`,
    [tenantId]
  )
  return rows[0] as WalletState | undefined
}

export interface EntryState {
  kind: string
  amount: number
  bucket: string
  operation_id: string | null
  grant_ref: string | null
  note: string | null
  actor: string
}

export async function entriesOf(
  container: MedusaContainer,
  tenantId: string
): Promise<EntryState[]> {
  const { rows } = await pgOf(container).raw(
    `SELECT kind, amount, bucket, operation_id, grant_ref, note, actor
       FROM ai_credit_entry WHERE tenant_id = ? ORDER BY created_at, kind, bucket, id`,
    [tenantId]
  )
  return rows as unknown as EntryState[]
}

export async function operationOf(
  container: MedusaContainer,
  tenantId: string,
  operationId: string
): Promise<Record<string, unknown> | undefined> {
  const { rows } = await pgOf(container).raw(
    `SELECT * FROM ai_credit_operation WHERE tenant_id = ? AND operation_id = ?`,
    [tenantId, operationId]
  )
  return rows[0]
}

/** The ledger's sum per bucket: what the wallet must hold. */
export async function ledgerSums(
  container: MedusaContainer,
  tenantId: string
): Promise<{ plan: number; purchased: number }> {
  const entries = await entriesOf(container, tenantId)
  const sum = (bucket: string) =>
    entries.filter((each) => each.bucket === bucket).reduce((total, each) => total + each.amount, 0)
  return { plan: sum("plan"), purchased: sum("purchased") }
}

/** Ledger and wallet agree, bucket by bucket. */
export async function expectLedgerMatchesWallet(
  container: MedusaContainer,
  tenantId: string
): Promise<void> {
  const wallet = await walletOf(container, tenantId)
  expect(await ledgerSums(container, tenantId)).toEqual({
    plan: wallet?.plan_balance ?? 0,
    purchased: wallet?.purchased_balance ?? 0,
  })
}

export const countBy = <T>(items: readonly T[], key: (item: T) => string) =>
  items.reduce<Record<string, number>>((counts, item) => {
    counts[key(item)] = (counts[key(item)] ?? 0) + 1
    return counts
  }, {})
