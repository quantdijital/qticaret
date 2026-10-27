import { z } from "@medusajs/framework/zod"
import { HOSTED_FORM_PROVIDERS } from "../../../../../lib/payments/checkout"

const returnUrl = z.url({ protocol: /^https?$/ }).max(2000)

/** Which hosted form, and where it sends the shopper back; everything else comes from the cart. */
export const StorePostCartPaymentSession = z
  .object({
    provider_id: z.enum(HOSTED_FORM_PROVIDERS),
    return_urls: z.object({ success: returnUrl, failure: returnUrl }).strict(),
  })
  .strict()

export type StorePostCartPaymentSessionType = z.infer<typeof StorePostCartPaymentSession>
