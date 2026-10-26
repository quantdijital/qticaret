import { z } from "@medusajs/framework/zod"

// A product page's or a listing's variants: enough for one request
const MAX_VARIANTS = 100

/** `?variant_id=…&variant_id=…` (or one), and the currency the shopper sees. */
export const StoreGetPriceDisplay = z
  .object({
    variant_id: z
      .union([z.string(), z.array(z.string())])
      .transform((value) => (Array.isArray(value) ? value : [value]))
      .pipe(z.array(z.string().min(1).max(100)).min(1).max(MAX_VARIANTS)),
    currency_code: z
      .string()
      .regex(/^[a-z]{3}$/i)
      .transform((value) => value.toLowerCase()),
  })
  .strict()
export type StoreGetPriceDisplayType = z.infer<typeof StoreGetPriceDisplay>
