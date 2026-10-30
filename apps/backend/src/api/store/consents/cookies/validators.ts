import { z } from "@medusajs/framework/zod"

/**
 * The cookie banner's answer (F13.8, adr/0041 §5): the categories beyond
 * the necessary ones, and the cookie policy's version the banner showed
 * (null while the shop has published none).
 */
export const StorePostCookieConsent = z
  .object({
    analytics: z.boolean(),
    marketing: z.boolean(),
    policy_version: z.number().int().positive().nullable(),
  })
  .strict()
export type StorePostCookieConsentType = z.infer<typeof StorePostCookieConsent>
