import { z } from "@medusajs/framework/zod"

/** A product kept for later, and its variant when one was picked. */
export const StorePostWishlistItem = z
  .object({
    product_id: z.string().regex(/^prod_[A-Za-z0-9]{1,40}$/),
    variant_id: z
      .string()
      .regex(/^variant_[A-Za-z0-9]{1,40}$/)
      .optional(),
  })
  .strict()
export type StorePostWishlistItemType = z.infer<typeof StorePostWishlistItem>
