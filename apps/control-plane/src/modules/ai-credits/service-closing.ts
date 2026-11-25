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

/** An open operation past its time, as the reconcile job reads it. */
export interface StaleOperation {
  id: string
  tenant_id: string
  operation_id: string
  created_at: Date
}

export interface ReleaseResult {
  released: boolean
  plan: number
  purchased: number
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
   * An open operation's credits given back when the provider did not take
   * its one call: the operation is `released` once, so a second release
   * changes nothing. Only an operation with one call so far: once a second
   * call was counted (`repeat`, possibly running at this moment), a failed
   * first call gives nothing back (the operation's charge holds for the
   * call that went on), and a call after the release finds the operation
   * closed (`expired_operation`). Both take the wallet's lock first, so one
   * of the two always sees the other. Each bucket gets back what it gave,
   * and the day's counter what it counted that day. The grant's part comes
   * back only within the month it was taken from: the grant does not carry
   * over (K5).
   */
  @InjectTransactionManager()
  async release(
    tenantId: string,
    operationId: string,
    clock: WalletClock,
    @MedusaContext() sharedContext: Context = {}
  ): Promise<ReleaseResult | Stale> {
    return await this.giveBack(
      sharedContext.transactionManager as Executor,
      tenantId,
      operationId,
      clock,
      "AND calls = 1",
      []
    )
  }

  /**
   * An operation still open that began before `startedBefore` (the
   * reconcile job's: past its life no call may join it, and an operation
   * never settled is closed in the shop's favour, whatever its calls).
   */
  @InjectTransactionManager()
  async releaseStale(
    tenantId: string,
    operationId: string,
    startedBefore: Date,
    clock: WalletClock,
    @MedusaContext() sharedContext: Context = {}
  ): Promise<ReleaseResult | Stale> {
    return await this.giveBack(
      sharedContext.transactionManager as Executor,
      tenantId,
      operationId,
      clock,
      "AND created_at < ?",
      [startedBefore]
    )
  }

  private async giveBack(
    manager: Executor,
    tenantId: string,
    operationId: string,
    clock: WalletClock,
    // One of the two fixed conditions above, never the caller's text
    condition: "AND calls = 1" | "AND created_at < ?",
    conditionParams: unknown[]
  ): Promise<ReleaseResult | Stale> {
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
          ${condition}
        RETURNING credits, plan_credits, purchased_credits, created_at`,
      [now, tenantId, operationId, ...conditionParams]
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

  /**
   * Operations still open that began before `before`, oldest first, `limit`
   * at a time: the next page starts after `after` (the last one read), so
   * one that cannot be released does not hold back the ones behind it.
   */
  @InjectManager()
  async staleOperations(
    before: Date,
    limit: number,
    after: StaleOperation | null = null,
    @MedusaContext() sharedContext: Context = {}
  ): Promise<StaleOperation[]> {
    const page = after === null ? "" : "AND (created_at, id) > (?, ?)"
    return await rowsOf(
      sharedContext.manager as Executor,
      `SELECT id, tenant_id, operation_id, created_at FROM ai_credit_operation
        WHERE status = 'open' AND created_at < ? AND deleted_at IS NULL ${page}
        ORDER BY created_at ASC, id ASC LIMIT ?`,
      after === null ? [before, limit] : [before, after.created_at, after.id, limit]
    )
  }
}
