import type { Context } from "@medusajs/framework/types"
import {
  InjectTransactionManager,
  MedusaContext,
  generateEntityId,
} from "@medusajs/framework/utils"
import { AI_OPERATION_TTL_SECONDS, AI_TASK_CREDITS, aiCallCap } from "@qticaret/types/control-plane"
import type { AiCreditCapability, AiCreditTask } from "@qticaret/types/control-plane"
import { istanbulDay } from "../../lib/billing/days"
import { istanbulMonth, splitCharge } from "../../lib/ai-credits/period"
import { STALE, addEntries, isStale, platformValues, rowsOf } from "./sql"
import type { Executor, Stale, WalletClock } from "./sql"
import { AiCreditGrants } from "./service-grants"

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
  | { kind: "clock_behind" }

interface OperationRow {
  task: string
  status: "open" | "charged" | "released"
  calls: number
  created_at: Date
}

/**
 * An operation's credits (adr/0085 §1, K3): taken once with one statement
 * on its first call, its later calls counted up to the task's cap
 * (service-closing.ts gives them back or keeps them).
 */
export class AiCreditOperations extends AiCreditGrants {
  /**
   * One call on credits. The credits are the platform's table's
   * (`AI_TASK_CREDITS`), never the caller's. An operation already charged
   * takes nothing and counts the call (`repeat`) while it is the same
   * task, open or charged, within its life and its calls. A new one is
   * charged by one statement that holds only while the balance covers it
   * and the day's cap allows it, the grant first, then the bought credits;
   * its ledger rows and the operation are written in the same transaction.
   * The day's counter starts again only on a later Istanbul day than its
   * own: a server whose clock is a little behind counts on the wallet's
   * day, never resets it. A wallet already in a later month than `now`
   * charges nothing (`clock_behind`).
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
    const wallet = await this.touch(manager, tenantId, clock)
    if (isStale(wallet)) {
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

    const period = istanbulMonth(now)
    if (wallet.plan_period !== null && wallet.plan_period > period) {
      // Another server's clock already rolled the wallet into a later month: this
      // one's clock is behind, and nothing is charged on it (the caller logs it)
      return { kind: "clock_behind" }
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
         spent_today = CASE WHEN w.spent_day >= ? THEN w.spent_today ELSE 0 END + ?,
         spent_day = GREATEST(w.spent_day, ?),
         updated_at = now()
       FROM prev
       WHERE w.id = prev.id
         AND w.plan_period = ?
         AND (w.purchased_balance = 0 OR w.purchased_expires_at > ?)
         AND w.plan_balance + w.purchased_balance >= ?
         AND CASE WHEN w.spent_day >= ? THEN w.spent_today ELSE 0 END + ?
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
        period,
        now,
        credits,
        day,
        credits,
        (await platformValues(manager)).dailyCap,
      ]
    )
    if (!charged) {
      // The wallet as made current above: its lock is held, nothing changed it since
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
}
