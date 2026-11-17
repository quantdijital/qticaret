import { z } from "@medusajs/framework/zod"
import { PANEL_REFUND_KEY } from "../../../../../workflows/orders/made-in-part"
import { CHECKED_NOTE_PREFIX } from "../../../../../workflows/orders/made-refund-record"
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
    // The panel's key for this refund (`newRefundReference`: a UUID's 32 hex digits): tried
    // again, it is made once. No other form: a cancel's, a return's, Medusa's own or the
    // recovery job's reference can never be named here (security review D4)
    reference: z.string().regex(PANEL_REFUND_KEY, "orders.refund_reference_invalid"),
    // Never a staff check's own note: it names the check's Medusa record (sixth round D-1)
    note: z
      .string()
      .trim()
      .max(500)
      .refine((note) => !note.toLowerCase().startsWith(CHECKED_NOTE_PREFIX), {
        message: "orders.refund_note_reserved",
      })
      .optional(),
  })
  .strict()
  .refine(oneWay, { message: "orders.refund_mode", path: ["amount"] })

/**
 * An open refund checked at the provider by staff: the money went back, or
 * it did not; or an iyzico refund made in part is closed at what its
 * answered parts gave back (D4-1). No amount: the server reads it from the
 * ledger's parts.
 */
export const AdminPostOrderRefundSettle = z
  .object({ outcome: z.enum(["made", "not_made", "made_in_part"]) })
  .strict()

// A ledger reference as the ledger keeps them: the panel's key, a cancel's, a return's, an edit's
export const LEDGER_REFERENCE = /^[A-Za-z0-9]{1,64}$/

export type AdminPostOrderRefundSettleType = z.infer<typeof AdminPostOrderRefundSettle>
export type AdminPostOrderRefundPreviewType = z.infer<typeof AdminPostOrderRefundPreview>
export type AdminPostOrderRefundType = z.infer<typeof AdminPostOrderRefund>
