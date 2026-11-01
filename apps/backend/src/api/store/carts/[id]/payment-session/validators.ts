import { z } from "@medusajs/framework/zod"
import {
  CHECKOUT_PROVIDERS,
  CREDIT_CHECKOUT,
  isHostedFormProvider,
} from "../../../../../lib/payments/checkout"

// PayTR takes return addresses up to 400 characters
const returnUrl = z.url({ protocol: /^https?$/ }).max(400)

/**
 * Which way to pay, and for a hosted form where it sends the shopper back;
 * everything else comes from the cart. Bank transfer and cash on delivery
 * send nobody anywhere (adr/0029).
 */
export const StorePostCartPaymentSession = z
  .object({
    // `credit`: nothing left to pay, the cart's gift cards cover it
    provider_id: z.enum([...CHECKOUT_PROVIDERS, CREDIT_CHECKOUT]),
    return_urls: z.object({ success: returnUrl, failure: returnUrl }).strict().optional(),
  })
  .strict()
  .superRefine((body, ctx) => {
    const hosted = isHostedFormProvider(body.provider_id)
    // A hosted form needs somewhere to send the shopper back; an offline way never sends anyone
    if (hosted !== Boolean(body.return_urls)) {
      ctx.addIssue({
        code: "custom",
        path: ["return_urls"],
        message: hosted ? "payments.return_urls_required" : "payments.return_urls_unexpected",
      })
    }
  })

export type StorePostCartPaymentSessionType = z.infer<typeof StorePostCartPaymentSession>
