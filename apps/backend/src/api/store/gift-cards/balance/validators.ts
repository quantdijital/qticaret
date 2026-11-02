import { z } from "@medusajs/framework/zod"

/** A gift card's code, as a shopper types it (normalised before the lookup). */
export const StorePostGiftCardBalance = z
  .object({ code: z.string().trim().min(4).max(64) })
  .strict()

export type StorePostGiftCardBalanceType = z.infer<typeof StorePostGiftCardBalance>
