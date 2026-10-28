import { z } from "@medusajs/framework/zod"
import { RETURN_REASONS, RETURN_STATUSES } from "../../../modules/return-requests/states"

const lines = z
  .array(
    z
      .object({
        line_item_id: z.string().regex(/^ordli_[0-9A-Za-z]{1,40}$/),
        quantity: z.number().int().positive().max(10_000),
      })
      .strict()
  )
  .min(1)
  .max(200)

/** A shopper's request: which lines of their order, why, and their own words (adr/0032). */
export const StorePostReturnRequest = z
  .object({
    items: lines,
    reason: z.enum(RETURN_REASONS),
    note: z.string().trim().max(1000).optional(),
  })
  .strict()
export type StorePostReturnRequestType = z.infer<typeof StorePostReturnRequest>

export const AdminGetReturnRequests = z
  .object({
    status: z.enum(RETURN_STATUSES).optional(),
    order_id: z
      .string()
      .regex(/^order_[0-9A-Za-z]{1,40}$/)
      .optional(),
    limit: z.coerce.number().int().min(1).max(100).default(50),
    offset: z.coerce.number().int().min(0).default(0),
  })
  .strict()
export type AdminGetReturnRequestsType = z.infer<typeof AdminGetReturnRequests>

export const AdminPostReturnApprove = z
  .object({ note: z.string().trim().max(1000).optional() })
  .strict()
export type AdminPostReturnApproveType = z.infer<typeof AdminPostReturnApprove>

export const AdminPostReturnReject = z.object({ note: z.string().trim().min(1).max(1000) }).strict()
export type AdminPostReturnRejectType = z.infer<typeof AdminPostReturnReject>

/** What reached the warehouse: at most what was asked, line by line. */
export const AdminPostReturnReceive = z.object({ items: lines }).strict()
export type AdminPostReturnReceiveType = z.infer<typeof AdminPostReturnReceive>
