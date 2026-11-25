import { istanbulDay } from "../billing/days"

/**
 * The calendar of the AI credits (adr/0085 K5, K7): a month's grant and a
 * day's cap follow Istanbul's calendar (`istanbulDay`, a fixed UTC+3), and
 * a bucket split is what the wallet's single statement does in SQL.
 */

const MONTH = /^(\d{4})-(\d{2})$/

/** The Istanbul month an instant falls in, `YYYY-MM`. */
export const istanbulMonth = (at: Date): string => istanbulDay(at).slice(0, 7)

/** The first day of the month after `period` (`YYYY-MM` → `YYYY-MM-DD`): the grant's renewal. */
export function nextMonthStart(period: string): string {
  const match = MONTH.exec(period)
  if (!match) {
    throw new Error(`not a month: ${period}`)
  }
  const total = Number(match[1]) * 12 + Number(match[2])
  const year = Math.floor(total / 12)
  const month = (total % 12) + 1
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-01`
}

/** `months` calendar months after `at` (UTC), the day clamped to the month's last. */
export function addMonths(at: Date, months: number): Date {
  const result = new Date(at.getTime())
  const day = result.getUTCDate()
  result.setUTCDate(1)
  result.setUTCMonth(result.getUTCMonth() + months)
  const last = new Date(Date.UTC(result.getUTCFullYear(), result.getUTCMonth() + 1, 0)).getUTCDate()
  result.setUTCDate(Math.min(day, last))
  return result
}

export interface BucketSplit {
  plan: number
  purchased: number
}

/**
 * How `credits` are taken: this month's grant first, the rest from the
 * bought credits (K6). The wallet's statement takes `LEAST(plan, credits)`
 * from the plan; this is the same rule, for the ledger's rows.
 */
export function splitCharge(planBalance: number, credits: number): BucketSplit {
  const plan = Math.min(Math.max(planBalance, 0), credits)
  return { plan, purchased: credits - plan }
}

/** The day's spend as it counts on `day`: the counter of another day counts nothing. */
export const spentOn = (spentToday: number, spentDay: string | null, day: string): number =>
  spentDay === day ? spentToday : 0
