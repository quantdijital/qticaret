import { z } from "@medusajs/framework/zod"

// A page's variants, as the public display takes them (`/store/price-display`)
export const MAX_WHOLESALE_VARIANTS = 100

/**
 * `?variant_id=…&variant_id=…` (or one). No currency, customer or group:
 * the shop's currency and the session's customer are the server's.
 */
export const StoreGetWholesalePrices = z
  .object({
    variant_id: z
      .union([z.string(), z.array(z.string())])
      .transform((value) => (Array.isArray(value) ? value : [value]))
      .pipe(
        z
          .array(z.string().regex(/^variant_[0-9A-Za-z]{1,64}$/))
          .min(1)
          .max(MAX_WHOLESALE_VARIANTS)
      ),
  })
  .strict()
export type StoreGetWholesalePricesType = z.infer<typeof StoreGetWholesalePrices>
