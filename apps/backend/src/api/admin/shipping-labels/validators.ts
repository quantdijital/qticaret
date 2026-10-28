import { z } from "@medusajs/framework/zod"

/** `?fulfillment_id=ful_…&fulfillment_id=…`: up to 20 parcels, as "Kargoya ver" takes orders. */
export const AdminGetBulkLabels = z
  .object({
    fulfillment_id: z.preprocess(
      // One id arrives as a string, several as a list
      (value: unknown): unknown[] => (Array.isArray(value) ? (value as unknown[]) : [value]),
      z
        .array(z.string().regex(/^ful_[0-9A-Z]{20,40}$/, "shipping.fulfillment_invalid"))
        .min(1)
        .max(20)
    ),
  })
  .strict()
export type AdminGetBulkLabelsType = z.infer<typeof AdminGetBulkLabels>
