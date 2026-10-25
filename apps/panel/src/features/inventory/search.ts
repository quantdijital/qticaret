import { z } from "zod"
import { STOCK_VIEWS } from "./api/stock"

/** The stock list's URL: `/inventory?view=low&q=GMLK&page=2` (1-based in the URL). */
export const stockSearchSchema = z.object({
  q: z.string().max(100).optional().catch(undefined),
  view: z.enum(STOCK_VIEWS).optional().catch(undefined),
  page: z.coerce.number().int().min(1).max(10_000).optional().catch(undefined),
})
