import { z } from "@medusajs/framework/zod"
import { CHECKOUT_PROVIDERS, isHostedFormProvider } from "../../../../../lib/payments/checkout"

// PayTR takes return addresses up to 400 characters
const returnUrl = z.url({ protocol: /^https?$/ }).max(400)

/**
 * Which way to pay, and for a hosted form where it sends the shopper back;
 * everything else comes from the cart. Bank transfer and cash on delivery
 * send nobody anywhere (adr/0029).
 */
export const StorePostCartPaymentSession = z
  .object({
    provider_id: z.enum(CHECKOUT_PROVIDERS),
    return_urls: z.object({ success: returnUrl, failure: returnUrl }).strict().optional(),
  })
  .strict()
  .superRefine((body, ctx) => {
    if (isHostedFormProvider(body.provider_id) && !body.return_urls) {
      ctx.addIssue({
        code: "custom",
        path: ["return_urls"],
        message: "payments.return_urls_required",
      })
    }
  })

export type StorePostCartPaymentSessionType = z.infer<typeof StorePostCartPaymentSession>
