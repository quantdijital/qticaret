import { z } from "@medusajs/framework/zod"

const page = {
  offset: z.coerce.number().int().min(0).max(100_000).default(0),
  limit: z.coerce.number().int().min(1).max(100).default(50),
}

export const StoreGetBrands = z
  .object({ ...page, q: z.string().trim().max(100).optional() })
  .strict()
export type StoreGetBrandsType = z.infer<typeof StoreGetBrands>

export const StoreGetBrandProducts = z.object(page).strict()
export type StoreGetBrandProductsType = z.infer<typeof StoreGetBrandProducts>
