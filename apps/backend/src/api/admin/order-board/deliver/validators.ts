import { z } from "@medusajs/framework/zod"

// A page of the list: what can be picked at once
export const MAX_BULK_DELIVER = 20

export const AdminPostDeliverOrders = z
  .object({
    order_ids: z
      .array(z.string().regex(/^order_[0-9A-Za-z]{1,40}$/))
      .min(1)
      .max(MAX_BULK_DELIVER),
  })
  .strict()
export type AdminPostDeliverOrdersType = z.infer<typeof AdminPostDeliverOrders>
