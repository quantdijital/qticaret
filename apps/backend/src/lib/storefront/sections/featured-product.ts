import { z } from "@medusajs/framework/zod"
import { base, optional, recordId, shopText, title } from "../layout-fields"

/** One product up close (adr/0046 Ek 2026-11-05): the storefront adds its facts and spec table. */
export const featuredProduct = z
  .object({
    ...base,
    type: z.literal("featured_product"),
    title,
    text: optional(shopText(240)),
    product_id: recordId,
  })
  .strict()
