import { z } from "@medusajs/framework/zod"
import { liraAmount } from "../../../../validation/lira"

const price = liraAmount(1_000_000, "orders.edit_price_kurus")

/**
 * An order's lines changed by staff (adr/0033): a new quantity (0 takes
 * the line off) or a corrected unit price for existing lines, and new
 * variants at Medusa's price.
 */
export const AdminPostOrderEditPreview = z
  .object({
    items: z
      .array(
        z
          .object({
            id: z.string().regex(/^ordli_[0-9A-Za-z]{1,40}$/),
            quantity: z.number().int().min(0).max(10_000),
            unit_price: z.union([z.literal(0), price]).optional(),
          })
          .strict()
      )
      .max(200)
      .default([]),
    add: z
      .array(
        z
          .object({
            variant_id: z.string().regex(/^variant_[0-9A-Za-z]{1,40}$/),
            quantity: z.number().int().positive().max(10_000),
          })
          .strict()
      )
      .max(50)
      .default([]),
    note: z.string().trim().max(500).optional(),
  })
  .strict()
export type AdminPostOrderEditPreviewType = z.infer<typeof AdminPostOrderEditPreview>

/**
 * The edit itself: the difference staff saw on the preview (lira,
 * positive when the shopper owes), only compared, never charged; and,
 * when the shopper owes, that staff collected it.
 */
export const AdminPostOrderEdit = AdminPostOrderEditPreview.extend({
  expected_difference: z
    .number()
    .min(-1_000_000_000)
    .max(1_000_000_000)
    .refine(
      (value) => Math.abs(value * 100 - Math.round(value * 100)) < 1e-6,
      "orders.edit_price_kurus"
    ),
  difference_collected: z.boolean().default(false),
  // The panel's key for this edit: sent again, it is made once
  reference: z.string().regex(/^[A-Za-z0-9]{8,40}$/, "orders.edit_reference_invalid"),
}).strict()
export type AdminPostOrderEditType = z.infer<typeof AdminPostOrderEdit>
