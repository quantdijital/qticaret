import { z } from "zod"
import { BULK_CHANNELS, BULK_STATUSES } from "./api/types"

/** The list's URL: `/bulk-messages?status=sent&channel=sms&page=2` (1-based in the URL). */
export const bulkMessageSearchSchema = z.object({
  status: z.enum(BULK_STATUSES).optional().catch(undefined),
  channel: z.enum(BULK_CHANNELS).optional().catch(undefined),
  page: z.coerce.number().int().min(1).max(10_000).optional().catch(undefined),
})

export type BulkMessageSearch = z.infer<typeof bulkMessageSearchSchema>
