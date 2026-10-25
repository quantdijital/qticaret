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
  key: PeriodKey
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

/** Which bucket `at` falls in, counting from `start`; -1 outside the `count` buckets. */
export function bucketIndex(start: Date, bucketMs: number, count: number, at: Date): number {
  const index = Math.floor((at.getTime() - start.getTime()) / bucketMs)
  return index >= 0 && index < count ? index : -1
}
