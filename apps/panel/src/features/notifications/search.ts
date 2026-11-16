import { z } from "zod"
import { ALERT_GROUPS, ALERT_STATES } from "./api"

/** The alerts page's URL: `/notifications?state=unread&group=orders&page=2` (1-based). */
export const notificationSearchSchema = z.object({
  state: z.enum(ALERT_STATES).optional().catch(undefined),
  group: z.enum(ALERT_GROUPS).optional().catch(undefined),
  page: z.coerce.number().int().min(1).max(10_000).optional().catch(undefined),
})
export type NotificationSearch = z.infer<typeof notificationSearchSchema>
