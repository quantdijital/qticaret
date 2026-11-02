import { z } from "@medusajs/framework/zod"

/** A consent request's token (32 random bytes, base64url), as its link carries it. */
export const StorePostConsentConfirm = z
  .object({ token: z.string().regex(/^[\w-]{20,100}$/) })
  .strict()
export type StorePostConsentConfirmType = z.infer<typeof StorePostConsentConfirm>
