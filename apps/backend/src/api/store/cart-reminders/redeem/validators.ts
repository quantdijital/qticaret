import { z } from "@medusajs/framework/zod"

/** The token from a cart reminder's link (32 random bytes, base64url). */
export const StorePostCartReminderRedeem = z
  .object({ token: z.string().regex(/^[\w-]{43}$/) })
  .strict()

export type StorePostCartReminderRedeemType = z.infer<typeof StorePostCartReminderRedeem>
