import { z } from "@medusajs/framework/zod"

/** A consent the shop records for a customer, as the customer told it (by phone, in the shop). */
export const AdminPostCustomerConsent = z
  .object({
    channel: z.enum(["email", "sms"]),
    status: z.enum(["granted", "revoked"]),
  })
  .strict()
export type AdminPostCustomerConsentType = z.infer<typeof AdminPostCustomerConsent>
