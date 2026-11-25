import { z } from "@medusajs/framework/zod"

// A count as the variant's stock field takes it; Medusa IDs are short; a product's variants bounded
const MAX_QUANTITY = 1_000_000
const MAX_VARIANTS = 500

/** Stock tracking on or off for the product's variants; a count only with it on. */
export const AdminPostProductStockTracking = z
  .object({
    tracked: z.boolean(),
    variants: z
      .array(
        z
          .object({
            id: z.string().min(1).max(64),
            quantity: z.number().int().min(0).max(MAX_QUANTITY).optional(),
          })
          .strict()
      )
      .min(1)
      .max(MAX_VARIANTS),
  })
  .strict()
  .refine((body) => body.tracked || body.variants.every((each) => each.quantity === undefined), {
    message: "stock_tracking.quantity_untracked",
    path: ["variants"],
  })

export type AdminPostProductStockTrackingType = z.infer<typeof AdminPostProductStockTracking>
