import { z } from "@medusajs/framework/zod"
import { liraAmount } from "../../../../validation/lira"

const lira = liraAmount(1_000_000_000, "orders.refund_amount_kurus")

const request = {
  items: z
    .array(
      z
        .object({
          id: z.string().min(1).max(64),
          quantity: z.number().int().positive().max(10_000),
        })
        .strict()
    )
    .max(200)
    .optional(),
  shipping: z.boolean().optional(),
  amount: lira.optional(),
}

// Units (and shipping), or a free amount: one or the other
const oneWay = (body: {
  items?: unknown[] | undefined
  shipping?: boolean | undefined
  amount?: number | undefined
}) => (body.amount !== undefined) !== ((body.items?.length ?? 0) > 0 || body.shipping === true)

export const AdminPostOrderRefundPreview = z
  .object(request)
  .strict()
  .refine(oneWay, { message: "orders.refund_mode", path: ["amount"] })

export const AdminPostOrderRefund = z
  .object({
    ...request,
    // The panel's key for this refund: tried again, it is made once
    reference: z.string().regex(/^[A-Za-z0-9]{8,40}$/, "orders.refund_reference_invalid"),
    note: z.string().trim().max(500).optional(),
  })
  .strict()
  .refine(oneWay, { message: "orders.refund_mode", path: ["amount"] })

export type AdminPostOrderRefundPreviewType = z.infer<typeof AdminPostOrderRefundPreview>
export type AdminPostOrderRefundType = z.infer<typeof AdminPostOrderRefund>
