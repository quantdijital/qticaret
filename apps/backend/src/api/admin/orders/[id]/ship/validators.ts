import { z } from "@medusajs/framework/zod"

const shipItems = z
  .array(
    z
      .object({
        id: z.string().min(1).max(64),
        quantity: z.number().int().positive().max(10_000),
      })
      .strict()
  )
  .min(1)
  .max(200)

/**
 * "Kargoya ver": what is left of the order, or a part of it (F7.10, the
 * server checks it against what is left); and whether to tell the customer.
 */
export const AdminPostShipOrder = z
  .object({ notify: z.boolean().default(true), items: shipItems.optional() })
  .strict()
export type AdminPostShipOrderType = z.infer<typeof AdminPostShipOrder>

/** "Kargoya ver" for several orders at once (F7.7), each whole. */
export const AdminPostShipOrders = z
  .object({
    order_ids: z
      .array(z.string().regex(/^order_[0-9A-Za-z]{1,40}$/))
      .min(1)
      .max(20),
    notify: z.boolean().default(true),
  })
  .strict()
export type AdminPostShipOrdersType = z.infer<typeof AdminPostShipOrders>
