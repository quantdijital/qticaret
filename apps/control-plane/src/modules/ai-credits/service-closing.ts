import type { Context } from "@medusajs/framework/types"
import { InjectManager, InjectTransactionManager, MedusaContext } from "@medusajs/framework/utils"
import { istanbulDay } from "../../lib/billing/days"
import { istanbulMonth } from "../../lib/ai-credits/period"
import { STALE, addEntries, rowsOf } from "./sql"
import type { Executor, Stale, WalletClock } from "./sql"
import { AiCreditOperations } from "./service-operations"

export interface OperationMeasures {
  service?: string | null
  model?: string | null
  inputTokens?: number | null
  outputTokens?: number | null
  images?: number | null
  estimatedCostMicros?: number | null
}

const measure = (value: number | null | undefined): number | null =>
  value === undefined || value === null || !Number.isSafeInteger(value) || value < 0
    ? null
    : Math.min(value, 2_147_483_647)

/**
 * How an open operation ends (adr/0085 §1): its credits given back when
 * the provider did not take the work (or it stayed open too long), or
 * kept with the call's measures. Each happens once: the operation's
 * status decides under its row's lock.
 */
export class AiCreditClosing extends AiCreditOperations {
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
}
