import { z } from "@medusajs/framework/zod"
import { ALERT_GROUP_NAMES, ALERT_STATES } from "../../../lib/notifications/feed"
import type { AlertGroup } from "../../../lib/notifications/feed"

export const AdminGetAlerts = z
  .object({
    state: z.enum(ALERT_STATES).default("all"),
    group: z.enum(ALERT_GROUP_NAMES as [AlertGroup, ...AlertGroup[]]).optional(),
    offset: z.coerce.number().int().min(0).max(100_000).default(0),
    limit: z.coerce.number().int().min(1).max(100).default(20),
  })
  .strict()
export type AdminGetAlertsType = z.infer<typeof AdminGetAlerts>

/** Some alerts read, or all of them; one of the two. */
export const AdminPostAlertsRead = z
  .object({
    ids: z.array(z.string().min(1).max(64)).min(1).max(100).optional(),
    all: z.literal(true).optional(),
  })
  .strict()
  .refine((body) => (body.ids === undefined) !== (body.all === undefined), {
    message: "notifications.read_target",
  })
export type AdminPostAlertsReadType = z.infer<typeof AdminPostAlertsRead>
