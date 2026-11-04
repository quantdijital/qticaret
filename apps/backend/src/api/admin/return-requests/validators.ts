import { z } from "@medusajs/framework/zod"
import {
  RETURN_KINDS,
  RETURN_REASONS,
  RETURN_STATUSES,
} from "../../../modules/return-requests/states"

const line = z
  .object({
    line_item_id: z.string().regex(/^ordli_[0-9A-Za-z]{1,40}$/),
    quantity: z.number().int().positive().max(10_000),
  })
  .strict()

/**
 * A shopper's request: which lines of their order, why, and their own
 * words (adr/0032); for an exchange (§6), the variant each line goes
 * back for. Never a price: the swap is priced on the server.
 */
export const StorePostReturnRequest = z
  .object({
    kind: z.enum(RETURN_KINDS).default("return"),
    items: z
      .array(
        line.extend({
          variant_id: z
            .string()
            .regex(/^variant_[0-9A-Za-z]{1,40}$/)
            .optional(),
        })
      )
      .min(1)
      .max(200),
    reason: z.enum(RETURN_REASONS),
    note: z.string().trim().max(1000).optional(),
  })
  .strict()
  .refine(
    (body) =>
      body.items.every((item) => (body.kind === "exchange") === (item.variant_id !== undefined)),
    { message: "returns.exchange_variant_invalid", path: ["items"] }
  )
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

/** Approval; for an exchange the shopper owes on, staff say they collected it (adr/0032 §6). */
export const AdminPostReturnApprove = z
  .object({
    note: z.string().trim().max(1000).optional(),
    difference_collected: z.boolean().default(false),
  })
  .strict()
export type AdminPostReturnApproveType = z.infer<typeof AdminPostReturnApprove>

export const AdminPostReturnReject = z.object({ note: z.string().trim().min(1).max(1000) }).strict()
export type AdminPostReturnRejectType = z.infer<typeof AdminPostReturnReject>

/** An approval taken back before anything came back: why, in staff's words, for the team. */
export const AdminPostReturnCancel = z
  .object({ reason: z.string().trim().min(1).max(1000) })
  .strict()
export type AdminPostReturnCancelType = z.infer<typeof AdminPostReturnCancel>

/**
 * What reached the warehouse: sound (back in stock), damaged (not) and
 * refused (a sealed good opened, MSY md. 15/1-ç: not refunded, sent back),
 * together at most what was asked, line by line; and, for lines outside
 * the right of withdrawal only, whether the shipping comes back too, the
 * staff's call (adr/0032 §5; a withdrawal gives it back by law, Ek
 * 2026-11-03).
 */
export const AdminPostReturnReceive = z
  .object({
    items: z.array(line).max(200).default([]),
    damaged: z.array(line).max(200).default([]),
    refused: z.array(line).max(200).default([]),
    refund_shipping: z.boolean().default(false),
  })
  .strict()
export type AdminPostReturnReceiveType = z.infer<typeof AdminPostReturnReceive>

/** "Refund" takes nothing: the amount comes from what was received. */
export const AdminPostReturnRefund = z.object({}).strict()
