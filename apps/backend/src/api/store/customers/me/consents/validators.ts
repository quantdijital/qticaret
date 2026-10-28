import { z } from "@medusajs/framework/zod"

/** The consent text the storefront showed, by its version (adr/0038 §2). */
export const consentTextVersion = z
  .string()
  .trim()
  .min(1)
  .max(40)
  .regex(/^[\w.-]+$/)

/** A customer gives or withdraws consent on a channel from their account. */
export const StorePostConsent = z
  .object({
    channel: z.enum(["email", "sms"]),
    status: z.enum(["granted", "revoked"]),
    text_version: consentTextVersion,
  })
  .strict()
export type StorePostConsentType = z.infer<typeof StorePostConsent>

/** The boxes ticked at checkout; an unticked box changes nothing. */
export const StorePostCheckoutConsent = z
  .object({
    email: z.boolean(),
    sms: z.boolean(),
    text_version: consentTextVersion,
  })
  .strict()
export type StorePostCheckoutConsentType = z.infer<typeof StorePostCheckoutConsent>
