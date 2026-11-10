import { z } from "@medusajs/framework/zod"
import { detectTaxIdKind } from "@qticaret/server-kit"

const legalName = z.string().trim().min(2).max(200)
// Spaces are common when typing long numbers; the rest must be digits.
const taxId = z
  .string()
  .max(32)
  .transform((value) => value.replace(/\s+/g, ""))

/**
 * Messages are i18n keys for the storefront. Zod issues never echo the
 * submitted tax id.
 */
export const StorePostBillingProfile = z
  .discriminatedUnion("type", [
    z.object({
      type: z.literal("individual"),
      legal_name: legalName,
      tax_id: taxId,
    }),
    z.object({
      type: z.literal("corporate"),
      legal_name: legalName,
      tax_office: z.string().trim().min(2, "billing_profile.tax_office_required").max(100),
      tax_id: taxId,
    }),
  ])
  .superRefine((value, ctx) => {
    const kind = detectTaxIdKind(value.tax_id)
    if (!kind || (value.type === "individual" && kind !== "tckn")) {
      ctx.addIssue({ code: "custom", path: ["tax_id"], message: "billing_profile.tax_id_invalid" })
    }
  })

export type StorePostBillingProfileType = z.infer<typeof StorePostBillingProfile>
