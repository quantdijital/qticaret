import type { Context } from "@medusajs/framework/types"
import { InjectManager, MedusaContext, MedusaError, MedusaService } from "@medusajs/framework/utils"
import { BillingSetting } from "./models/billing-setting"
import { Charge } from "./models/charge"
import { Reminder } from "./models/reminder"
import { Subscription } from "./models/subscription"
import type { TenantStatus } from "@qticaret/types/control-plane"
import { CHARGE_FIELDS, SUBSCRIPTION_FIELDS } from "./types"
import type { ChargeRecord, SubscriptionRecord } from "./types"

interface Executor {
  execute: (sql: string, params: unknown[]) => Promise<unknown>
}

const notFound = (key: string) => new MedusaError(MedusaError.Types.NOT_FOUND, key)

/**
 * `AND` the subscription's shop is in none of these statuses (review I1):
 * one read of the tenants module's table in the same database, no list of
 * shop ids (so no cap, however many shops are closed). The statuses are
 * the contract's words, never input; a shop with no record counts as gone.
 */
const shopNotIn = (column: string, statuses: readonly TenantStatus[]) =>
  `AND EXISTS (SELECT 1 FROM tenant t WHERE t.id = ${column} AND t.deleted_at IS NULL
     AND t.status NOT IN (${statuses.map((status) => `'${status}'`).join(", ")}))`

/** Shops that sell nothing now (suspended) or are being closed: no recurring revenue. */
const NOT_PAYING: readonly TenantStatus[] = ["suspended", "closing", "closed"]
/** Shops billing no longer moves (adr/0061 Ek C16 L1): no renewal. */
const GONE: readonly TenantStatus[] = ["closing", "closed"]

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

  /**
   * A shop's own payment history (Ek C20): its charges but the voided, the
   * latest period first, at most `take`. Only by the shop's id: the tenant
   * API passes the id its signature proved.
   */
  @InjectManager()
  async historyOf(
    tenantId: string,
    take: number,
    @MedusaContext() sharedContext: Context = {}
  ): Promise<ChargeRecord[]> {
    return await this.listCharges(
      { tenant_id: tenantId, status: ["open", "paid", "waived"] },
      {
        select: [...CHARGE_FIELDS],
        order: { period_start: "DESC", created_at: "DESC" },
        take,
      },
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
   * by status and period, in kuruş, TRY only, of shops that are not
   * suspended or being closed. The normalising to a month is the caller's
   * (`lib/dashboard/revenue.ts`).
   */
  @InjectManager()
  async recurringTotals(@MedusaContext() sharedContext: Context = {}): Promise<RecurringTotal[]> {
    const rows = (await (sharedContext.manager as Executor).execute(
      `SELECT status, period, count(*)::int AS count, coalesce(sum(price), 0)::bigint AS total
         FROM subscription
        WHERE deleted_at IS NULL AND currency_code = 'TRY'
          AND status IN ('trialing', 'active', 'past_due', 'restricted')
          ${shopNotIn("subscription.tenant_id", NOT_PAYING)}
        GROUP BY status, period`,
      []
    )) as (Omit<RecurringTotal, "total"> & { total: string })[]
    return rows.map((row) => ({ ...row, total: Number(row.total) }))
  }

  /**
   * Renewals whose charge is not open yet (Ek C18): subscriptions whose
   * next period starts between `from` and `to` (inclusive) with no charge
   * for it (charges open 14 days ahead, `CHARGE_LEAD_DAYS`). Counted per
   * package (the charge will be the package's price then), the first
   * `limit` by day. Cancelled ones and shops being closed are left out.
   */
  @InjectManager()
  async projectedRenewals(
    window: { from: string; to: string; limit: number },
    @MedusaContext() sharedContext: Context = {}
  ): Promise<{
    byPackage: { package_id: string; count: number }[]
    next: { tenant_id: string; package_id: string; due_on: string }[]
  }> {
    const manager = sharedContext.manager as Executor
    const from = `FROM subscription s
      WHERE s.deleted_at IS NULL AND s.status <> 'cancelled'
        AND s.current_period_end >= ? AND s.current_period_end <= ?
        ${shopNotIn("s.tenant_id", GONE)}
        AND NOT EXISTS (SELECT 1 FROM charge c WHERE c.subscription_id = s.id
                         AND c.period_start = s.current_period_end AND c.deleted_at IS NULL)`
    const params = [window.from, window.to]
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
