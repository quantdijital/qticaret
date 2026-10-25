import { z } from "zod"

/** The dashboard's periods; the URL keeps the choice (`/?period=7d`). */
export const PERIODS = ["today", "7d", "30d", "90d"] as const
export type PeriodKey = (typeof PERIODS)[number]
export const DEFAULT_PERIOD: PeriodKey = "30d"

export const dashboardSearchSchema = z.object({
  period: z.enum(PERIODS).optional().catch(undefined),
})
