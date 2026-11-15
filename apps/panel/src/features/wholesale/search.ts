import { z } from "zod"
import { ACCOUNT_STATUSES } from "./api/types"

/** The wholesalers' URL: `/customers/wholesale?status=pending&q=kaya&page=2` (1-based). */
export const wholesaleListSearchSchema = z.object({
  q: z.string().max(100).optional().catch(undefined),
  status: z.enum(ACCOUNT_STATUSES).optional().catch(undefined),
  page: z.coerce.number().int().min(1).max(10_000).optional().catch(undefined),
})

/** The levels' URL: `/customers/wholesale/tiers?page=2`. */
export const tierListSearchSchema = z.object({
  page: z.coerce.number().int().min(1).max(10_000).optional().catch(undefined),
})
