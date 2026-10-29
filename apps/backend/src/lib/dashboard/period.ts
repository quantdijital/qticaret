/**
 * The dashboard's time windows (docs/17, panel dashboard): today by hour,
 * or the last 7, 30 or 90 days by day, each against the window of the same
 * length just before it. Days start at midnight in Turkey, which has kept
 * UTC+3 all year since 2016; a tenant time zone comes with F19.
 */

export const PERIODS = ["today", "7d", "30d", "90d"] as const
export type PeriodKey = (typeof PERIODS)[number]

const HOUR_MS = 60 * 60 * 1000
const DAY_MS = 24 * HOUR_MS
const TURKEY_OFFSET_MS = 3 * HOUR_MS
const DAYS: Record<Exclude<PeriodKey, "today">, number> = { "7d": 7, "30d": 30, "90d": 90 }

export interface PeriodWindow {
  /** A preset, or "range" for days a report named (F11.1). */
  key: PeriodKey | "range"
  granularity: "hour" | "day"
  from: Date
  to: Date
  /** The same span just before `from`, for the comparison. */
  previousFrom: Date
  previousTo: Date
  /** Start of each bucket of the current window, in order. */
  buckets: Date[]
  bucketMs: number
}

export function startOfTurkishDay(now: Date): Date {
  const local = now.getTime() + TURKEY_OFFSET_MS
  return new Date(local - (local % DAY_MS) - TURKEY_OFFSET_MS)
}

const times = (count: number, start: number, step: number): Date[] =>
  Array.from({ length: count }, (_, index) => new Date(start + index * step))

export function periodWindow(key: PeriodKey, now: Date = new Date()): PeriodWindow {
  const today = startOfTurkishDay(now).getTime()
  if (key === "today") {
    const hours = Math.floor((now.getTime() - today) / HOUR_MS) + 1
    return {
      key,
      granularity: "hour",
      from: new Date(today),
      to: now,
      previousFrom: new Date(today - DAY_MS),
      previousTo: new Date(now.getTime() - DAY_MS),
      buckets: times(hours, today, HOUR_MS),
      bucketMs: HOUR_MS,
    }
  }
  const days = DAYS[key]
  const from = today - (days - 1) * DAY_MS
  return {
    key,
    granularity: "day",
    from: new Date(from),
    to: now,
    previousFrom: new Date(from - days * DAY_MS),
    previousTo: new Date(now.getTime() - days * DAY_MS),
    buckets: times(days, from, DAY_MS),
    bucketMs: DAY_MS,
  }
}

/** The longest range a report reads at once (F11.1, adr/0039): a year and a day. */
export const MAX_RANGE_DAYS = 366

const DAY_TEXT = /^(\d{4})-(\d{2})-(\d{2})$/

/** Midnight in Turkey of a `YYYY-MM-DD` day, as an instant; null for one that is no date. */
export function turkishDayStart(day: string): Date | null {
  const match = DAY_TEXT.exec(day)
  if (!match) {
    return null
  }
  const [, year, month, date] = match.map(Number) as [number, number, number, number]
  const utc = Date.UTC(year, month - 1, date)
  const back = new Date(utc)
  // 2026-02-30 is no day: Date would roll it into March
  if (back.getUTCMonth() !== month - 1 || back.getUTCDate() !== date) {
    return null
  }
  return new Date(utc - TURKEY_OFFSET_MS)
}

/** A day as Turkey names it, `YYYY-MM-DD`, for an instant. */
export function turkishDay(at: Date): string {
  return new Date(at.getTime() + TURKEY_OFFSET_MS).toISOString().slice(0, 10)
}

/**
 * Days a report names (F11.1): `from` to `to`, both included, as Turkey
 * counts days; by hour when it is one day, else by day. A range that runs
 * into today ends now. Against the same number of days just before it.
 * Null for a range that is no range: a bad date, backwards, in the future
 * or longer than MAX_RANGE_DAYS.
 */
export function rangeWindow(from: string, to: string, now: Date = new Date()): PeriodWindow | null {
  const start = turkishDayStart(from)
  const last = turkishDayStart(to)
  if (!start || !last || last < start || start > now) {
    return null
  }
  const days = Math.round((last.getTime() - start.getTime()) / DAY_MS) + 1
  if (days > MAX_RANGE_DAYS) {
    return null
  }
  const end = Math.min(last.getTime() + DAY_MS, now.getTime())
  const span = days * DAY_MS
  const hourly = days === 1
  const step = hourly ? HOUR_MS : DAY_MS
  return {
    key: "range",
    granularity: hourly ? "hour" : "day",
    from: start,
    to: new Date(end),
    previousFrom: new Date(start.getTime() - span),
    previousTo: new Date(end - span),
    buckets: times(Math.ceil((end - start.getTime()) / step), start.getTime(), step),
    bucketMs: step,
  }
}

/** Which bucket `at` falls in, counting from `start`; -1 outside the `count` buckets. */
export function bucketIndex(start: Date, bucketMs: number, count: number, at: Date): number {
  const index = Math.floor((at.getTime() - start.getTime()) / bucketMs)
  return index >= 0 && index < count ? index : -1
}
