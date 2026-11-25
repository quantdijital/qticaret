import { z } from "@medusajs/framework/zod"
import { BulkChange, MAX_BULK_PRODUCTS } from "../../../../../workflows/catalog/bulk-edit/change"

/** The products a bulk change names (1–1,000, each once) and the change, as the job takes them. */
export const AdminPostBulkEditPreview = z
  .object({
    product_ids: z
      .array(z.string().min(1).max(64))
      .min(1)
      .max(MAX_BULK_PRODUCTS)
      .refine((ids) => new Set(ids).size === ids.length),
    change: BulkChange,
  })
  .strict()
export type AdminPostBulkEditPreviewType = z.infer<typeof AdminPostBulkEditPreview>
