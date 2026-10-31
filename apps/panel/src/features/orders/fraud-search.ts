import { z } from "zod"

/** The review queue's URL: `/orders/review?view=approved&page=2` (1-based in the URL). */
export const fraudSearchSchema = z.object({
  view: z.enum(["pending", "approved", "rejected"]).optional().catch(undefined),
  page: z.coerce.number().int().min(1).max(10_000).optional().catch(undefined),
})
