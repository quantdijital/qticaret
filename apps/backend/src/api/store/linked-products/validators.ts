import { z } from "@medusajs/framework/zod"
import { LINKED_KINDS } from "../../../lib/catalog/linked-products"

// A product page's one product, or a cart's products: enough for any cart
const MAX_SOURCES = 50

/** `?kind=upsell&product_id=…` (a product page) or `?kind=cross_sell&product_id=…&product_id=…` (a cart). */
export const StoreGetLinkedProducts = z
  .object({
    kind: z.enum(LINKED_KINDS),
    product_id: z
      .union([z.string(), z.array(z.string())])
      .transform((value) => (Array.isArray(value) ? value : [value]))
      .pipe(
        z
          .array(z.string().regex(/^prod_[0-9A-Za-z]{1,64}$/))
          .min(1)
          .max(MAX_SOURCES)
      ),
  })
  .strict()
export type StoreGetLinkedProductsType = z.infer<typeof StoreGetLinkedProducts>
