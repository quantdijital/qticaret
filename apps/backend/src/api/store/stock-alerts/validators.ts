import { z } from "@medusajs/framework/zod"

/** "Tell me when it is back": the variant, and a guest's address. */
export const StorePostStockAlert = z
  .object({
    variant_id: z.string().regex(/^variant_[A-Za-z0-9]{1,40}$/),
    email: z.string().trim().toLowerCase().max(254).pipe(z.email()).optional(),
  })
  .strict()
export type StorePostStockAlertType = z.infer<typeof StorePostStockAlert>
