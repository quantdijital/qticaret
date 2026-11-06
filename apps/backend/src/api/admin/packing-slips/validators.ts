import { z } from "@medusajs/framework/zod"

/** The most orders printed at once: a few pages of the list, picked. */
export const MAX_PACKING_ORDERS = 50

const ORDER_ID = /^order_[0-9A-Za-z]{1,40}$/

/** `?ids=order_1,order_2`: the orders whose packing slips or pick list are printed. */
export const AdminGetPackingSlips = z
  .object({
    ids: z
      .string()
      .max(MAX_PACKING_ORDERS * 48)
      .transform((text) => [...new Set(text.split(",").map((id) => id.trim()))])
      .pipe(z.array(z.string().regex(ORDER_ID)).min(1).max(MAX_PACKING_ORDERS)),
  })
  .strict()
export type AdminGetPackingSlipsType = z.infer<typeof AdminGetPackingSlips>
