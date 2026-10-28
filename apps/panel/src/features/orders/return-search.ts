import { z } from "zod"

/** The return queue's URL: `/orders/returns?view=approved&page=2` (1-based in the URL). */
export const returnSearchSchema = z.object({
  view: z
    .enum(["requested", "approved", "received", "refunded", "rejected", "all"])
    .optional()
    .catch(undefined),
  page: z.coerce.number().int().min(1).max(10_000).optional().catch(undefined),
})
