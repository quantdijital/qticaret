import { z } from "@medusajs/framework/zod"
import { consentTextVersion } from "../customers/me/consents/validators"

/** The storefront's newsletter box: an address, and the consent text's version it showed. */
export const StorePostNewsletter = z
  .object({
    email: z.string().trim().toLowerCase().max(254).pipe(z.email()),
    text_version: consentTextVersion,
  })
  .strict()
export type StorePostNewsletterType = z.infer<typeof StorePostNewsletter>
