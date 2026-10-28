import { z } from "@medusajs/framework/zod"

/**
 * A consent the shop records for a customer, as the customer told it (by
 * phone, in the shop). A grant says how it was given (adr/0038 §2): the
 * proof İYS and a complaint ask for; a withdrawal needs none.
 */
export const AdminPostCustomerConsent = z
  .object({
    channel: z.enum(["email", "sms"]),
    status: z.enum(["granted", "revoked"]),
    evidence: z.string().trim().max(500).optional(),
  })
  .strict()
  .refine((body) => body.status === "revoked" || (body.evidence?.length ?? 0) >= 10, {
    message: "messaging.consent_evidence_required",
    path: ["evidence"],
  })
export type AdminPostCustomerConsentType = z.infer<typeof AdminPostCustomerConsent>
