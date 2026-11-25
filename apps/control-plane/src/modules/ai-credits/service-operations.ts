import type { Context } from "@medusajs/framework/types"
import {
  InjectManager,
  InjectTransactionManager,
  MedusaContext,
  MedusaError,
  generateEntityId,
} from "@medusajs/framework/utils"
import { AI_OPERATION_TTL_SECONDS, AI_TASK_CREDITS, aiCallCap } from "@qticaret/types/control-plane"
import type { AiCreditCapability, AiCreditTask } from "@qticaret/types/control-plane"
import { istanbulDay } from "../../lib/billing/days"
import { istanbulMonth, splitCharge } from "../../lib/ai-credits/period"
import { AI_DAILY_CAP_DEFAULT } from "../../lib/ai-credits/settings"
import { STALE, addEntries, rowsOf } from "./sql"
import type { Executor, Stale, WalletClock } from "./sql"
import { AiCreditWallets } from "./service-wallet"
import type { WalletRow } from "./service-wallet"

export interface SpendRequest {
  tenantId: string
  operationId: string
  task: AiCreditTask
  capability: AiCreditCapability
}

/** What a call on credits got (adr/0085 §1, K3, K7). */
export type SpendOutcome =
  | {
      kind: "charged"
      credits: number
      plan: number
      purchased: number
      balance: { plan: number; purchased: number }
    }
  | { kind: "repeat"; calls: number; balance: { plan: number; purchased: number } }
  | { kind: "exhausted" }
  | { kind: "daily_cap" }
  | { kind: "call_cap" }
  | { kind: "expired_operation" }
  | { kind: "task_mismatch" }

export interface OperationMeasures {
  service?: string | null
  model?: string | null
  inputTokens?: number | null
  outputTokens?: number | null
  images?: number | null
  estimatedCostMicros?: number | null
}

interface OperationRow {
  task: string
  status: "open" | "charged" | "released"
  calls: number
  created_at: Date
}

const measure = (value: number | null | undefined): number | null =>
  value === undefined || value === null || !Number.isSafeInteger(value) || value < 0
    ? null
    : Math.min(value, 2_147_483_647)

/**
 * An operation's credits (adr/0085 §1, K3): taken once with one statement
 * on its first call, its later calls counted up to the task's cap, given
 * back to the same buckets when the provider did not take the work, or
 * kept with the call's measures.
 */
export class AiCreditOperations extends AiCreditWallets {
  /**
   * One call on credits. The credits are the platform's table's
   * (`AI_TASK_CREDITS`), never the caller's. An operation already charged
   * takes nothing and counts the call (`repeat`) while it is the same
   * task, open or charged, within its life and its calls. A new one is
   * charged by one statement that holds only while the balance covers it
   * and the day's cap allows it (the day's counter starts again on a new
   * Istanbul day), the grant first, then the bought credits; its ledger
   * rows and the operation are written in the same transaction.
   */
  @InjectTransactionManager()
  async spend(
    request: SpendRequest,
    clock: WalletClock,
    @MedusaContext() sharedContext: Context = {}
  ): Promise<SpendOutcome | Stale> {
    const manager = sharedContext.transactionManager as Executor
    const { tenantId, operationId, task, capability } = request
    const { now } = clock
    if ((await this.touch(manager, tenantId, clock)) === STALE) {
      return STALE
    }
    const youngerThan = new Date(now.getTime() - AI_OPERATION_TTL_SECONDS * 1000)
    const [again] = await rowsOf<{ calls: number }>(
      manager,
      `UPDATE ai_credit_operation SET calls = calls + 1, updated_at = now()
        WHERE tenant_id = ? AND operation_id = ? AND deleted_at IS NULL
          AND task = ? AND status IN ('open', 'charged') AND calls < ? AND created_at > ?
        RETURNING calls`,
      [tenantId, operationId, task, aiCallCap(task), youngerThan]
    )
    if (again) {
      const wallet = await this.walletRow(manager, tenantId)
      return {
        kind: "repeat",
        calls: again.calls,
        balance: { plan: wallet.plan_balance, purchased: wallet.purchased_balance },
      }
    }
    const [known] = await rowsOf<OperationRow>(
      manager,
      `SELECT task, status, calls, created_at FROM ai_credit_operation
        WHERE tenant_id = ? AND operation_id = ? AND deleted_at IS NULL`,
      [tenantId, operationId]
    )
    if (known) {
      if (known.task !== task) {
        return { kind: "task_mismatch" }
      }
      // A released operation gave its credits back: a later call is a new operation
      return known.status === "released" || known.created_at.getTime() <= youngerThan.getTime()
        ? { kind: "expired_operation" }
        : { kind: "call_cap" }
    }

    const credits = AI_TASK_CREDITS[task]
    const day = istanbulDay(now)
    const [charged] = await rowsOf<{
      prev_plan: number
      plan_balance: number
      purchased_balance: number
    }>(
      manager,
      `WITH prev AS (
         SELECT id, plan_balance FROM ai_credit_wallet
          WHERE tenant_id = ? AND deleted_at IS NULL FOR UPDATE
       )
       UPDATE ai_credit_wallet w SET
         plan_balance = w.plan_balance - LEAST(w.plan_balance, ?),
         purchased_balance = w.purchased_balance - (? - LEAST(w.plan_balance, ?)),
         spent_today = CASE WHEN w.spent_day = ? THEN w.spent_today ELSE 0 END + ?,
         spent_day = ?,
         updated_at = now()
       FROM prev
       WHERE w.id = prev.id
         AND w.plan_period = ?
         AND (w.purchased_balance = 0 OR w.purchased_expires_at > ?)
         AND w.plan_balance + w.purchased_balance >= ?
         AND CASE WHEN w.spent_day = ? THEN w.spent_today ELSE 0 END + ?
             <= COALESCE(w.daily_cap, ?)
       RETURNING prev.plan_balance AS prev_plan, w.plan_balance, w.purchased_balance`,
      [
        tenantId,
        credits,
        credits,
        credits,
        day,
        credits,
        day,
        istanbulMonth(now),
        now,
        credits,
        day,
        credits,
        AI_DAILY_CAP_DEFAULT,
      ]
    )
    if (!charged) {
      const wallet = await this.walletRow(manager, tenantId)
      return wallet.plan_balance + wallet.purchased_balance < credits
        ? { kind: "exhausted" }
        : { kind: "daily_cap" }
    }
    const split = splitCharge(charged.prev_plan, credits)
    await manager.execute(
      `INSERT INTO ai_credit_operation
         (id, tenant_id, operation_id, task, capability, credits, plan_credits, purchased_credits,
          calls, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, 'open', ?, ?)`,
      [
        generateEntityId(undefined, "aiop"),
        tenantId,
        operationId,
        task,
        capability,
        credits,
        split.plan,
        split.purchased,
        now,
        now,
      ]
    )
    await addEntries(manager, [
      {
        tenantId,
        kind: "spend",
        amount: -split.plan,
        bucket: "plan",
        operationId,
        actor: "system",
        at: now,
      },
      {
        tenantId,
        kind: "spend",
        amount: -split.purchased,
        bucket: "purchased",
        operationId,
        actor: "system",
        at: now,
      },
    ])
    return {
      kind: "charged",
      credits,
      plan: split.plan,
      purchased: split.purchased,
      balance: { plan: charged.plan_balance, purchased: charged.purchased_balance },
    }
  }

  /**
   * An open operation's credits given back (the provider did not take the
   * work, or it stayed open too long): the operation is `released` once,
   * so a second release changes nothing. Each bucket gets back what it
   * gave, and the day's counter what it counted that day. The grant's part
   * comes back only within the month it was taken from: the grant does not
   * carry over (K5).
   */
  @InjectTransactionManager()
  async release(
    tenantId: string,
    operationId: string,
    clock: WalletClock,
    @MedusaContext() sharedContext: Context = {}
  ): Promise<{ released: boolean; plan: number; purchased: number } | Stale> {
    const manager = sharedContext.transactionManager as Executor
    const { now } = clock
    if ((await this.touch(manager, tenantId, clock)) === STALE) {
      return STALE
    }
    const [closed] = await rowsOf<{
      credits: number
      plan_credits: number
      purchased_credits: number
      created_at: Date
    }>(
      manager,
      `UPDATE ai_credit_operation SET status = 'released', closed_at = ?, updated_at = now()
        WHERE tenant_id = ? AND operation_id = ? AND deleted_at IS NULL AND status = 'open'
        RETURNING credits, plan_credits, purchased_credits, created_at`,
      [now, tenantId, operationId]
    )
    if (!closed) {
      return { released: false, plan: 0, purchased: 0 }
    }
    const month = istanbulMonth(closed.created_at)
    const [after] = await rowsOf<{ plan_period: string | null }>(
      manager,
      `UPDATE ai_credit_wallet SET
         plan_balance = plan_balance + CASE WHEN plan_period = ? THEN ? ELSE 0 END,
         purchased_balance = purchased_balance + ?,
         spent_today = CASE WHEN spent_day = ? THEN GREATEST(spent_today - ?, 0) ELSE spent_today END,
         updated_at = now()
        WHERE tenant_id = ? AND deleted_at IS NULL
        RETURNING plan_period`,
      [
        month,
        closed.plan_credits,
        closed.purchased_credits,
        istanbulDay(closed.created_at),
        closed.credits,
        tenantId,
      ]
    )
    const plan = after?.plan_period === month ? closed.plan_credits : 0
    await addEntries(manager, [
      {
        tenantId,
        kind: "release",
        amount: plan,
        bucket: "plan",
        operationId,
        actor: "system",
        at: now,
      },
      {
        tenantId,
        kind: "release",
        amount: closed.purchased_credits,
        bucket: "purchased",
        operationId,
        actor: "system",
        at: now,
      },
    ])
    return { released: true, plan, purchased: closed.purchased_credits }
  }

  /** An open operation kept (`charged`) with its call's measures; once, later calls change nothing. */
  @InjectTransactionManager()
  async settle(
    tenantId: string,
    operationId: string,
    measures: OperationMeasures,
    now: Date,
    @MedusaContext() sharedContext: Context = {}
  ): Promise<{ settled: boolean }> {
    const rows = await rowsOf<{ id: string }>(
      sharedContext.transactionManager as Executor,
      `UPDATE ai_credit_operation SET status = 'charged', closed_at = ?, service = ?, model = ?,
              input_tokens = ?, output_tokens = ?, images = ?, estimated_cost_micros = ?,
              updated_at = now()
        WHERE tenant_id = ? AND operation_id = ? AND deleted_at IS NULL AND status = 'open'
        RETURNING id`,
      [
        now,
        measures.service?.slice(0, 64) ?? null,
        measures.model?.slice(0, 128) ?? null,
        measure(measures.inputTokens),
        measure(measures.outputTokens),
        measure(measures.images),
        measure(measures.estimatedCostMicros),
        tenantId,
        operationId,
      ]
    )
    return { settled: rows.length > 0 }
  }

  /** Operations still open that began before `before`, oldest first. */
  @InjectManager()
  async staleOperations(
    before: Date,
    limit: number,
    @MedusaContext() sharedContext: Context = {}
  ): Promise<{ tenant_id: string; operation_id: string }[]> {
    return await rowsOf(
      sharedContext.manager as Executor,
      `SELECT tenant_id, operation_id FROM ai_credit_operation
        WHERE status = 'open' AND created_at < ? AND deleted_at IS NULL
        ORDER BY created_at ASC LIMIT ?`,
      [before, limit]
    )
  }

  protected async walletRow(manager: Executor, tenantId: string): Promise<WalletRow> {
    const [row] = await rowsOf<WalletRow>(
      manager,
      `SELECT plan_balance, plan_period, purchased_balance, purchased_expires_at, daily_cap,
              spent_today, spent_day
         FROM ai_credit_wallet WHERE tenant_id = ? AND deleted_at IS NULL`,
      [tenantId]
    )
    if (!row) {
      throw new MedusaError(MedusaError.Types.UNEXPECTED_STATE, "cp.ai_credit_wallet_missing")
    }
    return row
  }
}
