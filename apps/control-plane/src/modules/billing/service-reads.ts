import type { Context } from "@medusajs/framework/types"
import { InjectManager, MedusaContext, MedusaError, MedusaService } from "@medusajs/framework/utils"
import { BillingSetting } from "./models/billing-setting"
import { Charge } from "./models/charge"
import { Reminder } from "./models/reminder"
import { Subscription } from "./models/subscription"
import { CHARGE_FIELDS, SUBSCRIPTION_FIELDS } from "./types"
import type { ChargeRecord, SubscriptionRecord } from "./types"

interface Executor {
  execute: (sql: string, params: unknown[]) => Promise<unknown>
}

const notFound = (key: string) => new MedusaError(MedusaError.Types.NOT_FOUND, key)

/** `AND column NOT IN (?, …)` for these values, nothing when there are none (one `?` each). */
const notIn = (column: string, values: readonly unknown[]) =>
  values.length > 0 ? `AND ${column} NOT IN (${values.map(() => "?").join(", ")})` : ""

/** Billing's reads (Ek C16): a shop's subscription, the subscriptions' ids, charges. */
export class BillingReads extends MedusaService({
  Subscription,
  Charge,
  Reminder,
  BillingSetting,
}) {
  @InjectManager()
  async subscriptionOf(
    tenantId: string,
    @MedusaContext() sharedContext: Context = {}
  ): Promise<SubscriptionRecord | null> {
    const [found] = await this.listSubscriptions(
      { tenant_id: tenantId },
      { select: [...SUBSCRIPTION_FIELDS], take: 1 },
      sharedContext
    )
    return (found as unknown as SubscriptionRecord | undefined) ?? null
  }

  /** Every subscription's id, oldest first, page by page (the job). */
  @InjectManager()
  async subscriptionIds(
    after: string,
    take: number,
    @MedusaContext() sharedContext: Context = {}
  ): Promise<string[]> {
    const rows = (await (sharedContext.manager as Executor).execute(
      `SELECT id FROM subscription WHERE deleted_at IS NULL AND id > ? ORDER BY id LIMIT ?`,
      [after, take]
    )) as { id: string }[]
    return rows.map((row) => row.id)
  }

  @InjectManager()
  async chargesOf(
    filter: { tenant_id?: string; subscription_id?: string; id?: string },
    @MedusaContext() sharedContext: Context = {}
  ): Promise<ChargeRecord[]> {
    return await this.listCharges(
      filter,
      { select: [...CHARGE_FIELDS], order: { due_on: "DESC", created_at: "DESC" }, take: 500 },
      sharedContext
    )
  }

  @InjectManager()
  async chargeOf(
    tenantId: string,
    chargeId: string,
    @MedusaContext() sharedContext: Context = {}
  ): Promise<ChargeRecord> {
    const [found] = await this.chargesOf({ tenant_id: tenantId, id: chargeId }, sharedContext)
    if (!found) {
      throw notFound("cp.charge_unknown")
    }
    return found
  }

  /**
   * The dashboard's recurring revenue (Ek C18): live subscriptions summed
   * by status and period, in kuruş, TRY only, leaving out the shops named
   * (suspended or being closed). The normalising to a month is the
   * caller's (`lib/dashboard/revenue.ts`).
   */
  @InjectManager()
  async recurringTotals(
    excludeTenantIds: readonly string[],
    @MedusaContext() sharedContext: Context = {}
  ): Promise<RecurringTotal[]> {
    const rows = (await (sharedContext.manager as Executor).execute(
      `SELECT status, period, count(*)::int AS count, coalesce(sum(price), 0)::bigint AS total
         FROM subscription
        WHERE deleted_at IS NULL AND currency_code = 'TRY'
          AND status IN ('trialing', 'active', 'past_due', 'restricted')
          ${notIn("tenant_id", excludeTenantIds)}
        GROUP BY status, period`,
      [...excludeTenantIds]
    )) as (Omit<RecurringTotal, "total"> & { total: string })[]
    return rows.map((row) => ({ ...row, total: Number(row.total) }))
  }

  /**
   * Renewals whose charge is not open yet (Ek C18): subscriptions whose
   * next period starts between `from` and `to` (inclusive) with no charge
   * for it (charges open 14 days ahead, `CHARGE_LEAD_DAYS`). Counted per
   * package (the charge will be the package's price then), the first
   * `limit` by day. Cancelled ones and the shops named are left out.
   */
  @InjectManager()
  async projectedRenewals(
    window: { from: string; to: string; excludeTenantIds: readonly string[]; limit: number },
    @MedusaContext() sharedContext: Context = {}
  ): Promise<{
    byPackage: { package_id: string; count: number }[]
    next: { tenant_id: string; package_id: string; due_on: string }[]
  }> {
    const manager = sharedContext.manager as Executor
    const from = `FROM subscription s
      WHERE s.deleted_at IS NULL AND s.status <> 'cancelled'
        AND s.current_period_end >= ? AND s.current_period_end <= ?
        ${notIn("s.tenant_id", window.excludeTenantIds)}
        AND NOT EXISTS (SELECT 1 FROM charge c WHERE c.subscription_id = s.id
                         AND c.period_start = s.current_period_end AND c.deleted_at IS NULL)`
    const params = [window.from, window.to, ...window.excludeTenantIds]
    const byPackage = (await manager.execute(
      `SELECT s.package_id, count(*)::int AS count ${from} GROUP BY s.package_id`,
      params
    )) as { package_id: string; count: number }[]
    const next = (await manager.execute(
      `SELECT s.tenant_id, s.package_id, s.current_period_end AS due_on ${from}
        ORDER BY s.current_period_end ASC, s.id ASC LIMIT ?`,
      [...params, window.limit]
    )) as { tenant_id: string; package_id: string; due_on: string }[]
    return { byPackage, next }
  }
}

export interface RecurringTotal {
  status: "trialing" | "active" | "past_due" | "restricted"
  period: "monthly" | "yearly"
  count: number
  /** Kuruş. */
  total: number
}
