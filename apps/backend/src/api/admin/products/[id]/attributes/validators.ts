import { z } from "@medusajs/framework/zod"

const MAX_KEYS = 100

const value = z.union([
  z.string().max(1000),
  z.number(),
  z.boolean(),
  z.array(z.string().max(100)).max(200),
  z.null(),
])

/** A product's template and values; each value is checked against its definition in the workflow. */
export const AdminPostProductAttributes = z
  .object({
    template_id: z.string().min(1).max(64).nullable(),
    values: z
      .record(z.string().max(64), value)
      .refine((values) => Object.keys(values).length <= MAX_KEYS, {
        message: "product_attributes.value_invalid",
      })
      .optional(),
    confirm_template_change: z.boolean().optional(),
  })
  .strict()
export type AdminPostProductAttributesType = z.infer<typeof AdminPostProductAttributes>
