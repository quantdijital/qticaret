import { z } from "@medusajs/framework/zod"

/** `?offset=&limit=`: a page of a landing page's products. */
export const StoreGetLandingProducts = z
  .object({
    offset: z.coerce.number().int().min(0).max(10_000).default(0),
    limit: z.coerce.number().int().min(1).max(100).default(24),
  })
  .strict()
export type StoreGetLandingProductsType = z.infer<typeof StoreGetLandingProducts>
