import { z } from "@medusajs/framework/zod"

/** A guest's stock alert token (32 random bytes, base64url), as its link carries it. */
export const StorePostStockAlertConfirm = z
  .object({ token: z.string().regex(/^[\w-]{20,100}$/) })
  .strict()
export type StorePostStockAlertConfirmType = z.infer<typeof StorePostStockAlertConfirm>
