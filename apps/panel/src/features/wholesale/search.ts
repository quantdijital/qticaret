import { z } from "zod"
import { orderListSearchSchema } from "@/features/orders/search"
import { ACCOUNT_STATUSES } from "./api/types"

/** The wholesalers' URL: `/wholesale?status=pending&q=kaya&page=2` (1-based). */
export const wholesaleListSearchSchema = z.object({
  q: z.string().max(100).optional().catch(undefined),
  status: z.enum(ACCOUNT_STATUSES).optional().catch(undefined),
  page: z.coerce.number().int().min(1).max(10_000).optional().catch(undefined),
})

/** The levels' URL: `/wholesale/tiers?page=2`. */
export const tierListSearchSchema = z.object({
  page: z.coerce.number().int().min(1).max(10_000).optional().catch(undefined),
})

/**
 * The wholesale orders' URL: the order list's filters and one wholesaler
 * (`/wholesale/orders?wholesaler=wacc_…&stage=to_ship`).
 */
export const wholesaleOrderSearchSchema = orderListSearchSchema.extend({
  wholesaler: z.string().max(64).optional().catch(undefined),
})
export type WholesaleOrderSearch = z.infer<typeof wholesaleOrderSearchSchema>
