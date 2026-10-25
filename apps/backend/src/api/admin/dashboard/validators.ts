import { z } from "@medusajs/framework/zod"
import { PERIODS } from "../../../lib/dashboard"

/** `?period=`: today, 7d, 30d or 90d; 30 days when left out. */
export const AdminGetDashboardOverview = z
  .object({ period: z.enum(PERIODS).default("30d") })
  .strict()
export type AdminGetDashboardOverviewType = z.infer<typeof AdminGetDashboardOverview>

/** The other dashboard reads take no parameters. */
export const AdminGetDashboardNoQuery = z.object({}).strict()
