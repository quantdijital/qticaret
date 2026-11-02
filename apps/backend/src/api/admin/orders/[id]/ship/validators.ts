import { z } from "@medusajs/framework/zod"
import { isCleanText } from "../../../../../lib/security/text"

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
// The shop's own parcel's tracking: a name, a number, and the carrier's https page
const tracking = z
  .object({
    carrier: z
      .string()
      .trim()
      .min(1)
      .max(60)
      .refine((value) => isCleanText(value), { message: "orders.tracking_invalid" }),
    number: z
      .string()
      .trim()
      .regex(/^[A-Za-z0-9-]{4,40}$/, { message: "orders.tracking_invalid" }),
    url: z
      .url({ protocol: /^https$/ })
      .max(500)
      .nullable()
      .optional()
      .transform((value) => value ?? null),
  })
  .strict()

export const AdminPostShipOrder = z
  .object({
    notify: z.boolean().default(true),
    items: shipItems.optional(),
    tracking: tracking.optional(),
  })
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
