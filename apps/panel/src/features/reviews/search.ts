import { z } from "zod"
import { REVIEW_STATUSES } from "./api/reviews"

/** The review list's URL: `/reviews?status=approved&page=2` (1-based in the URL). */
export const reviewListSearchSchema = z.object({
  status: z.enum(REVIEW_STATUSES).optional().catch(undefined),
  page: z.coerce.number().int().min(1).max(10_000).optional().catch(undefined),
})
