import { z } from "@medusajs/framework/zod"
import { CONTRACT_PAYMENTS, LEGAL_KINDS } from "../../../../../lib/legal"

/** The contracts the storefront showed, by the versions it showed (adr/0041 §2). */
export const StorePostLegalConsents = z
  .object({
    documents: z
      .array(z.object({ kind: z.enum(LEGAL_KINDS), version: z.number().int().positive() }).strict())
      .min(1)
      .max(LEGAL_KINDS.length),
  })
  .strict()
export type StorePostLegalConsentsType = z.infer<typeof StorePostLegalConsents>

/** The way to pay the shopper chose on the page, for the text only. */
export const StoreGetCartContract = z
  .object({ payment: z.enum(CONTRACT_PAYMENTS).optional() })
  .strict()
export type StoreGetCartContractType = z.infer<typeof StoreGetCartContract>
