import { z } from "@medusajs/framework/zod"

const REASONS = ["not_received", "unauthorized", "not_as_described", "duplicate", "other"] as const
const note = z.string().trim().max(1000)

export const AdminGetChargebacks = z
  .object({
    status: z.enum(["open", "evidence_submitted", "won", "lost"]).optional(),
    order_id: z
      .string()
      .regex(/^order_[0-9A-Za-z]{1,40}$/)
      .optional(),
    limit: z.coerce.number().int().min(1).max(100).default(50),
    offset: z.coerce.number().int().min(0).default(0),
  })
  .strict()
export type AdminGetChargebacksType = z.infer<typeof AdminGetChargebacks>

/** A dispute from the provider's notice; the amount in lira, checked against what was paid. */
export const AdminPostChargeback = z
  .object({
    order_id: z.string().regex(/^order_[0-9A-Za-z]{1,40}$/),
    amount: z
      .number()
      .positive()
      .max(10_000_000)
      .refine(
        (value) =>
          Number.isInteger(Math.round(value * 100)) &&
          Math.abs(value * 100 - Math.round(value * 100)) < 1e-6,
        "chargebacks.amount_invalid"
      ),
    reason: z.enum(REASONS),
    provider_reference: z.string().trim().max(100).optional(),
    due_at: z.iso.datetime({ offset: true }).optional(),
    note: note.optional(),
  })
  .strict()
export type AdminPostChargebackType = z.infer<typeof AdminPostChargeback>

export const AdminPostChargebackMove = z
  .object({ status: z.enum(["evidence_submitted", "won", "lost"]), note: note.optional() })
  .strict()
export type AdminPostChargebackMoveType = z.infer<typeof AdminPostChargebackMove>
