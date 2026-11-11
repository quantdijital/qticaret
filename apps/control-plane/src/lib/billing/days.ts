import type { BillingPeriod } from "@qticaret/types/control-plane"

/**
 * Calendar days in Europe/Istanbul (Ek C16): `YYYY-MM-DD`. Türkiye keeps
 * UTC+3 the whole year (no daylight saving since 2016), the same fixed
 * offset the usage report's month uses (`usagePeriodOf`, Ek C13).
 */
const OFFSET_MS = 3 * 60 * 60 * 1000
const DAY_MS = 24 * 60 * 60 * 1000

const asDate = (day: string) => new Date(`${day}T00:00:00.000Z`)
const asDay = (date: Date) => date.toISOString().slice(0, 10)

/** The Istanbul day an instant falls on. */
export const istanbulDay = (at: Date): string => asDay(new Date(at.getTime() + OFFSET_MS))

/** The Istanbul hour of an instant, 0-23. */
export const istanbulHour = (at: Date): number => new Date(at.getTime() + OFFSET_MS).getUTCHours()

export function addDays(day: string, days: number): string {
  const date = asDate(day)
  date.setUTCDate(date.getUTCDate() + days)
  return asDay(date)
}

/** Days from `from` to `to` (negative when `to` is earlier). */
export const daysBetween = (from: string, to: string): number =>
  Math.round((asDate(to).getTime() - asDate(from).getTime()) / DAY_MS)

const daysInMonth = (year: number, month: number) =>
  new Date(Date.UTC(year, month + 1, 0)).getUTCDate()

/**
 * `months` after `day`, on the anchor's day of the month or the month's
 * last day when it is shorter: a subscription from 31 January renews on 28
 * (29) February, then 31 March, never drifting to the 28th.
 */
export function addMonthsAnchored(day: string, months: number, anchorDay: number): string {
  const date = asDate(day)
  const total = date.getUTCFullYear() * 12 + date.getUTCMonth() + months
  const year = Math.floor(total / 12)
  const month = total % 12
  const dayOfMonth = Math.min(anchorDay, daysInMonth(year, month))
  return asDay(new Date(Date.UTC(year, month, dayOfMonth)))
}

/** The next period's first day after one starting `day`. */
export const periodEnd = (day: string, period: BillingPeriod, anchorDay: number): string =>
  addMonthsAnchored(day, period === "yearly" ? 12 : 1, anchorDay)

/** The day of the month a day falls on. */
export const dayOfMonth = (day: string): number => asDate(day).getUTCDate()

const DAY = /^\d{4}-\d{2}-\d{2}$/

/** Whether `value` is a real calendar day written `YYYY-MM-DD`. */
export const isDay = (value: string): boolean =>
  DAY.test(value) && !Number.isNaN(asDate(value).getTime()) && asDay(asDate(value)) === value
