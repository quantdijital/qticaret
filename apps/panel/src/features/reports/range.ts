import { z } from "zod"
import { DEFAULT_PERIOD, PERIODS } from "@/features/dashboard/period"
import type { PeriodKey } from "@/features/dashboard/period"

const DAY = /^\d{4}-\d{2}-\d{2}$/

/**
 * A report's days in the address (F11.1): a preset `period`, or `from`
 * and `to` as Turkish days; the server checks the range (≤366 days).
 */
export const reportSearchSchema = z.object({
  period: z.enum(PERIODS).optional().catch(undefined),
  from: z.string().regex(DAY).optional().catch(undefined),
  to: z.string().regex(DAY).optional().catch(undefined),
})
export type ReportSearch = z.infer<typeof reportSearchSchema>

export type ReportRange = { period: PeriodKey } | { from: string; to: string }

/** The range the address names: its days when both are there, else its period. */
export const rangeOf = (search: ReportSearch): ReportRange =>
  search.from && search.to
    ? { from: search.from, to: search.to }
    : { period: search.period ?? DEFAULT_PERIOD }

/** A day `YYYY-MM-DD` as Turkey names it, for an instant. */
export const turkishDay = (at: Date): string =>
  new Date(at.getTime() + 3 * 60 * 60 * 1000).toISOString().slice(0, 10)
