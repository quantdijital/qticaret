/**
 * Whole days in Turkey (UTC+3, no summer time) for date inputs: a day's
 * first and last second, and the day a moment falls on ("2026-11-01").
 */

export const dayStart = (day: string) => (day ? new Date(`${day}T00:00:00+03:00`) : null)
export const dayEnd = (day: string) => (day ? new Date(`${day}T23:59:59+03:00`) : null)
export const dayOf = (when: string | Date | null | undefined) =>
  when ? new Date(new Date(when).getTime() + 3 * 3_600_000).toISOString().slice(0, 10) : ""
