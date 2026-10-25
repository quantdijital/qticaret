import { z } from "zod"

/** The product list's URL: `/products?status=draft&q=kupa&page=2` (1-based in the URL). */
export const productListSearchSchema = z.object({
  q: z.string().max(100).optional().catch(undefined),
  status: z.enum(["all", "published", "draft"]).optional().catch(undefined),
  page: z.coerce.number().int().min(1).max(10_000).optional().catch(undefined),
})

export type ProductListSearch = z.infer<typeof productListSearchSchema>
