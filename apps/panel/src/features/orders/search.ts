import { z } from "zod"
import { ORDER_STAGES } from "./api/orders"

/** The order list's URL: `/orders?stage=to_ship&q=1042&page=2` (1-based in the URL). */
export const orderListSearchSchema = z.object({
  q: z.string().max(100).optional().catch(undefined),
  stage: z.enum(ORDER_STAGES).optional().catch(undefined),
  page: z.coerce.number().int().min(1).max(10_000).optional().catch(undefined),
})

export type OrderListSearch = z.infer<typeof orderListSearchSchema>
