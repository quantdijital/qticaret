import { z } from "@medusajs/framework/zod"

// A listing's page, a search's or a home rail's: enough for one request
const MAX_PRODUCTS = 100

/** `?id=…&id=…` (or one): the products of one storefront page. */
export const StoreGetCardFacts = z
  .object({
    id: z
      .union([z.string(), z.array(z.string())])
      .transform((value) => (Array.isArray(value) ? value : [value]))
      .pipe(
        z
          .array(z.string().regex(/^prod_[0-9A-Za-z]{1,64}$/))
          .min(1)
          .max(MAX_PRODUCTS)
      ),
  })
  .strict()
export type StoreGetCardFactsType = z.infer<typeof StoreGetCardFacts>
