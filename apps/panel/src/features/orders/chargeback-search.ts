import { z } from "zod"

/** The chargeback queue's URL: `/orders/chargebacks?view=lost&page=2` (1-based in the URL). */
export const chargebackSearchSchema = z.object({
  view: z.enum(["open", "evidence_submitted", "won", "lost", "all"]).optional().catch(undefined),
  page: z.coerce.number().int().min(1).max(10_000).optional().catch(undefined),
})
