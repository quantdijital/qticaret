import type { PopupDayCounts } from "./api/types"

const DAYS = 30
const DAY_MS = 24 * 60 * 60 * 1000

/** The last 30 days' impressions, a day with no count as 0 (the answer leaves them out). */
export function dailyImpressions(
  daily: readonly PopupDayCounts[],
  now: Date = new Date()
): number[] {
  const byDay = new Map(daily.map((day) => [day.day, day.impressions]))
  return Array.from({ length: DAYS }, (_, index) => {
    const day = new Date(now.getTime() - (DAYS - 1 - index) * DAY_MS).toISOString().slice(0, 10)
    return byDay.get(day) ?? 0
  })
}
