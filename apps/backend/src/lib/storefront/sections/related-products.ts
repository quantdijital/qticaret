import { z } from "@medusajs/framework/zod"
import { LAYOUT_LIMITS, columns, columnsMobile, title } from "../layout-fields"
import { bodyFields } from "./look"
import { collectionSource, manualSource } from "./sources"

/** Products shown under a product's own: its category's, a collection's, or chosen ones. */
export const relatedProducts = z
  .object({
    ...bodyFields,
    type: z.literal("related_products"),
    title,
    source: z.discriminatedUnion("kind", [
      z.object({ kind: z.literal("same_category") }).strict(),
      collectionSource,
      manualSource(LAYOUT_LIMITS.related),
    ]),
    limit: z.number().int().min(1).max(LAYOUT_LIMITS.related).default(8),
    columns,
    columns_mobile: columnsMobile,
  })
  .strict()
