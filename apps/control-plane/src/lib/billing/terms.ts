import type { BillingPeriod, PlanBillingSummary } from "@qticaret/types/control-plane"

export type SubscriptionTerms = Required<
  Pick<PlanBillingSummary, "period" | "price" | "trial_started_on" | "trial_ends_on">
>

/**
 * The subscription's terms the shop's panel shows (adr/0061 Ek C20): what
 * a period costs and how long it is, and the trial's first and next-paid
 * day. With a subscription its own copy (the running period's price, a
 * price change shows from the next period, as it is charged); before one,
 * the package's price and period and no trial (none has started).
 * Facts that change only with billing: the document is not reissued by
 * the clock.
 */
export function subscriptionTerms(
  sub: {
    price: number
    period: BillingPeriod
    started_on: string
    trial_ends_on: string | null
  } | null,
  plan: { price: number; period: BillingPeriod }
): SubscriptionTerms {
  if (!sub) {
    return { period: plan.period, price: plan.price, trial_started_on: null, trial_ends_on: null }
  }
  const trial = sub.trial_ends_on !== null && sub.trial_ends_on > sub.started_on
  return {
    period: sub.period,
    price: sub.price,
    trial_started_on: trial ? sub.started_on : null,
    trial_ends_on: trial ? sub.trial_ends_on : null,
  }
}
