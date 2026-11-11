import type { Context } from "@medusajs/framework/types"
import { InjectTransactionManager, MedusaContext, MedusaError } from "@medusajs/framework/utils"
import { addDays, dayOfMonth, periodEnd } from "../../lib/billing/days"
import { CHARGE_LEAD_DAYS, graceOf, nothingOwed, subscriptionStatus } from "../../lib/billing/rules"
import { omit } from "../../lib/omit"
import { BillingReads } from "./service-reads"
import { CHARGE_FIELDS, SUBSCRIPTION_FIELDS } from "./types"
import type { ChargeRecord, PackageTerms, SubscriptionRecord } from "./types"

interface Executor {
  execute: (sql: string, params: unknown[]) => Promise<unknown>
}

// A job that stopped for long catches up this many periods in one run, no more
const MAX_ROLLS = 24

export interface Advanced {
  /** The subscription as it was, to undo the run. */
  before: SubscriptionRecord
  /** Charges this run opened. */
  opened: string[]
  status: { from: SubscriptionRecord["status"]; to: SubscriptionRecord["status"] }
}

const notFound = (key: string) => new MedusaError(MedusaError.Types.NOT_FOUND, key)

/**
 * Subscriptions and their charges (adr/0061 §2 `billing`, §7, Ek C16).
 * Every change to a subscription runs under its row's lock, so the hourly
 * job and a staff action never interleave; a period's charge is unique per
 * subscription and start.
 */
export class BillingSubscriptions extends BillingReads {
  /**
   * A shop's subscription started on `today` (adr/0061 §7, Ek C16): the
   * package's trial, then its first paid period, whose charge opens now
   * and is due on that period's first day (the trial's end, or today).
   * Idempotent: a shop that has one keeps it (`created: false`).
   */
  @InjectTransactionManager()
  async startSubscription(
    tenantId: string,
    terms: PackageTerms,
    today: string,
    @MedusaContext() sharedContext: Context = {}
  ): Promise<{ created: boolean; id: string; charge_id: string | null }> {
    await (sharedContext.transactionManager as Executor).execute(
      "SELECT pg_advisory_xact_lock(hashtext(?))",
      [`subscription:${tenantId}`]
    )
    const existing = await this.subscriptionOf(tenantId, sharedContext)
    if (existing) {
      return { created: false, id: existing.id, charge_id: null }
    }
    const trial = terms.trial_days > 0
    const paidFrom = trial ? addDays(today, terms.trial_days) : today
    const anchor = dayOfMonth(paidFrom)
    const firstEnd = periodEnd(paidFrom, terms.period, anchor)
    const [made] = await this.createSubscriptions(
      [
        {
          tenant_id: tenantId,
          package_id: terms.id,
          price: terms.price,
          period: terms.period,
          started_on: today,
          trial_ends_on: trial ? paidFrom : null,
          // A trial is a period of its own, unpaid; the first paid one follows it
          current_period_start: today,
          current_period_end: trial ? paidFrom : firstEnd,
          anchor_day: anchor,
          grace_days: terms.grace_days,
          status: trial ? "trialing" : "active",
        },
      ],
      sharedContext
    )
    const id = made?.id ?? ""
    const [charge] = await this.createCharges(
      [
        {
          subscription_id: id,
          tenant_id: tenantId,
          period: terms.period,
          period_start: paidFrom,
          period_end: firstEnd,
          amount: terms.price,
          list_amount: terms.price,
          due_on: paidFrom,
          ...nothingOwed(terms.price),
        },
      ],
      sharedContext
    )
    return { created: true, id, charge_id: charge?.id ?? null }
  }

  /**
   * One day of a subscription (Ek C16): the next period's charge opened
   * `CHARGE_LEAD_DAYS` before it is due, priced from the package as it is
   * then (`terms`; null when the shop is on no package: nothing new
   * opens); a period that ended rolls to the next, the subscription taking
   * that period's price and period from its charge (a price change applies
   * from the next period, no proration); then its state from its open
   * charges. Under the row's lock.
   */
  @InjectTransactionManager()
  async advanceSubscription(
    id: string,
    terms: PackageTerms | null,
    today: string,
    @MedusaContext() sharedContext: Context = {}
  ): Promise<Advanced> {
    const sub = await this.lockedSubscription(id, sharedContext)
    const opened: string[] = []
    let current = { ...sub }
    for (let rolls = 0; rolls <= MAX_ROLLS; rolls += 1) {
      const next = await this.periodCharge(id, current.current_period_end, sharedContext)
      const due = today >= addDays(current.current_period_end, -CHARGE_LEAD_DAYS)
      let charge = next
      if (!charge && due && terms) {
        charge = await this.openCharge(current, terms, sharedContext)
        opened.push(charge.id)
      }
      if (today < current.current_period_end || !charge) {
        break
      }
      current = {
        ...current,
        package_id: terms?.id ?? current.package_id,
        price: charge.list_amount,
        period: charge.period,
        current_period_start: charge.period_start,
        current_period_end: charge.period_end,
        grace_days: terms?.grace_days ?? current.grace_days,
      }
    }
    const status = await this.statusOn(current, today, sharedContext)
    await this.updateSubscriptions(
      {
        id,
        ...omit(current, "id", "tenant_id", "created_at", "started_on", "anchor_day"),
        status,
      },
      sharedContext
    )
    return { before: sub, opened, status: { from: sub.status, to: status } }
  }

  /** The state its open charges give it today, written; the change comes back. */
  @InjectTransactionManager()
  async refreshStatus(
    id: string,
    today: string,
    @MedusaContext() sharedContext: Context = {}
  ): Promise<{ from: SubscriptionRecord["status"]; to: SubscriptionRecord["status"] }> {
    const sub = await this.lockedSubscription(id, sharedContext)
    const status = await this.statusOn(sub, today, sharedContext)
    if (status !== sub.status) {
      await this.updateSubscriptions({ id, status }, sharedContext)
    }
    return { from: sub.status, to: status }
  }

  /** A subscription put back as it was and the charges a run opened removed (an undo). */
  @InjectTransactionManager()
  async restoreSubscription(
    before: SubscriptionRecord,
    opened: string[],
    @MedusaContext() sharedContext: Context = {}
  ): Promise<void> {
    await this.lockedSubscription(before.id, sharedContext)
    if (opened.length > 0) {
      await this.deleteCharges(opened, sharedContext)
    }
    await this.updateSubscriptions(
      omit(before, "tenant_id", "created_at") as unknown as { id: string },
      sharedContext
    )
  }

  /** The shop's own grace days (null: the package's), with the reason; the old values come back. */
  @InjectTransactionManager()
  async setGraceOverride(
    id: string,
    days: number | null,
    reason: string | null,
    @MedusaContext() sharedContext: Context = {}
  ): Promise<SubscriptionRecord> {
    const sub = await this.lockedSubscription(id, sharedContext)
    await this.updateSubscriptions(
      { id, grace_days_override: days, grace_override_reason: days === null ? null : reason },
      sharedContext
    )
    return sub
  }

  protected async lockedSubscription(
    id: string,
    sharedContext: Context
  ): Promise<SubscriptionRecord> {
    await (sharedContext.transactionManager as Executor).execute(
      "SELECT id FROM subscription WHERE id = ? FOR UPDATE",
      [id]
    )
    const [found] = await this.listSubscriptions(
      { id },
      { select: [...SUBSCRIPTION_FIELDS], take: 1 },
      sharedContext
    )
    if (!found) {
      throw notFound("cp.subscription_unknown")
    }
    return found
  }

  protected async statusOn(sub: SubscriptionRecord, today: string, sharedContext: Context) {
    const charges = await this.listCharges(
      { subscription_id: sub.id, status: "open" },
      { select: ["status", "due_on", "amount"], take: 500 },
      sharedContext
    )
    return subscriptionStatus(
      {
        trial_ends_on: sub.trial_ends_on,
        graceDays: graceOf(sub),
        charges: charges,
      },
      today
    )
  }

  private async periodCharge(subscriptionId: string, start: string, sharedContext: Context) {
    const [found] = await this.listCharges(
      { subscription_id: subscriptionId, period_start: start },
      { select: [...CHARGE_FIELDS], take: 1 },
      sharedContext
    )
    return (found as unknown as ChargeRecord | undefined) ?? null
  }

  private async openCharge(
    sub: SubscriptionRecord,
    terms: PackageTerms,
    sharedContext: Context
  ): Promise<ChargeRecord> {
    const start = sub.current_period_end
    const [made] = await this.createCharges(
      [
        {
          subscription_id: sub.id,
          tenant_id: sub.tenant_id,
          period: terms.period,
          period_start: start,
          period_end: periodEnd(start, terms.period, sub.anchor_day),
          amount: terms.price,
          list_amount: terms.price,
          due_on: start,
          ...nothingOwed(terms.price),
        },
      ],
      sharedContext
    )
    return made as unknown as ChargeRecord
  }
}
