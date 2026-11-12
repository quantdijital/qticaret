import { addDays } from "../billing/days"

/**
 * The dashboard's money rules (adr/0061 C18, Ek C18), pure. Amounts are
 * kuruş, TRY.
 *
 * - **Monthly recurring revenue:** the running price of every subscription
 *   that pays (`active`, `past_due`, `restricted`) of a shop that is not
 *   suspended or being closed. A yearly price counts as a twelfth: the
 *   yearly prices are summed first and the sum divided by twelve, rounded
 *   half up to a whole kuruş once (never per subscription, so many small
 *   remainders do not add up to a wrong lira).
 * - Subscriptions in their trial pay nothing yet: their count and the
 *   revenue they would add (the same rule) are reported apart.
 * - **Upcoming renewals:** what falls due in the next `RENEWAL_DAYS`
 *   Istanbul days, today included.
 */

export const PAYING_STATUSES = ["active", "past_due", "restricted"] as const
export const RENEWAL_DAYS = 30
/** Rows a dashboard list shows; the full lists are their own pages. */
export const DASHBOARD_LIST = 5

export interface PeriodTotal {
  status: string
  period: "monthly" | "yearly"
  count: number
  /** Kuruş, the sum of the running prices. */
  total: number
}

/** Monthly and yearly sums as a month's revenue: monthly + yearly / 12, rounded once. */
export function monthlyOf(rows: readonly PeriodTotal[]): number {
  const sum = (period: PeriodTotal["period"]) =>
    rows.filter((row) => row.period === period).reduce((total, row) => total + row.total, 0)
  return sum("monthly") + Math.round(sum("yearly") / 12)
}

/** The recurring revenue of paying subscriptions, and of trialing ones apart. */
export function recurringRevenue(rows: readonly PeriodTotal[]) {
  const paying = rows.filter((row) => (PAYING_STATUSES as readonly string[]).includes(row.status))
  const trialing = rows.filter((row) => row.status === "trialing")
  const count = (of: readonly PeriodTotal[]) => of.reduce((total, row) => total + row.count, 0)
  return {
    mrr: monthlyOf(paying),
    paying_count: count(paying),
    trial: { count: count(trialing), mrr: monthlyOf(trialing) },
    currency_code: "TRY",
  }
}

/** The renewal window from an Istanbul day: that day and the next `RENEWAL_DAYS - 1`. */
export const renewalWindow = (today: string) => ({
  from: today,
  to: addDays(today, RENEWAL_DAYS - 1),
})
