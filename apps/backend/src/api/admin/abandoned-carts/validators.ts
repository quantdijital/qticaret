import { z } from "@medusajs/framework/zod"

export const ABANDONED_CART_PAGE_MAX = 50

export const AdminGetAbandonedCarts = z
  .object({
    limit: z.coerce.number().int().min(1).max(ABANDONED_CART_PAGE_MAX).default(20),
    offset: z.coerce.number().int().min(0).max(100_000).default(0),
  })
  .strict()
export type AdminGetAbandonedCartsType = z.infer<typeof AdminGetAbandonedCarts>

/** "E-posta ile hatırlat" takes nothing but the cart's id. */
export const AdminPostAbandonedCartRemind = z.object({}).strict()
