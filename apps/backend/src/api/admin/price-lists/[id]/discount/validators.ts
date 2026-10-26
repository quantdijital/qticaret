import { z } from "@medusajs/framework/zod"

/** A percentage off the products' own prices; the amounts are worked out on the server. */
export const AdminPostPriceListDiscount = z
  .object({
    product_ids: z.array(z.string().min(1)).min(1).max(500),
    percent: z.number().multipleOf(0.01).min(0.01).max(99),
    // A new rate for the list's own lines only: none taken out of it comes back
    only_listed: z.boolean().default(false),
  })
  .strict()
export type AdminPostPriceListDiscountType = z.infer<typeof AdminPostPriceListDiscount>
