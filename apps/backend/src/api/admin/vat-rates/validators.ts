import { z } from "@medusajs/framework/zod"
import { isCleanText } from "../../../lib/security"
import { VAT_CODE, VAT_NAME_MAX, hasVatPrecision } from "../../../lib/tax"

// A rate's name, as the panel and the product type show it: no control characters
const name = z
  .string()
  .trim()
  .min(1, "vat.name_invalid")
  .max(VAT_NAME_MAX, "vat.name_invalid")
  .refine((value) => isCleanText(value), "vat.name_invalid")

/** `{ rate: 8.5, name?: "KDV %8,5", code?: "KDV8_5" }`: a percentage, at most two decimals. */
export const AdminPostVatRate = z
  .object({
    rate: z
      .number()
      .min(0, "vat.rate_invalid")
      .max(100, "vat.rate_invalid")
      .refine(hasVatPrecision, "vat.rate_invalid"),
    name: name.optional(),
    code: z.string().trim().regex(VAT_CODE, "vat.code_invalid").optional(),
  })
  .strict()
export type AdminPostVatRateType = z.infer<typeof AdminPostVatRate>

/**
 * `{ name?, active? }`: renamed, taken out of use (`false`) or brought back
 * (`true`). A rate taken out keeps the name it had.
 */
export const AdminUpdateVatRate = z
  .object({ name: name.optional(), active: z.boolean().optional() })
  .strict()
  .refine((body) => body.name !== undefined || body.active !== undefined, "errors.invalid_data")
  .refine((body) => !(body.active === false && body.name !== undefined), "vat.rate_inactive")
export type AdminUpdateVatRateType = z.infer<typeof AdminUpdateVatRate>

/** `{ rate_id }`: the rate products on no VAT type are taxed at. */
export const AdminPostVatDefault = z.object({ rate_id: z.string().trim().min(1).max(64) }).strict()
export type AdminPostVatDefaultType = z.infer<typeof AdminPostVatDefault>
