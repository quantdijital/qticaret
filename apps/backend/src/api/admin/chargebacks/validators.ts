import { z } from "@medusajs/framework/zod"
import { CHARGEBACK_REASONS, CHARGEBACK_STATUSES } from "../../../modules/chargebacks/states"
import { liraAmount } from "../../validation/lira"

const note = z.string().trim().max(1000)

export const AdminGetChargebacks = z
  .object({
    status: z.enum(CHARGEBACK_STATUSES).optional(),
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
    amount: liraAmount(10_000_000, "chargebacks.amount_invalid"),
    reason: z.enum(CHARGEBACK_REASONS),
    provider_reference: z.string().trim().max(100).optional(),
    due_at: z.iso.datetime({ offset: true }).optional(),
    note: note.optional(),
  })
  .strict()
export type AdminPostChargebackType = z.infer<typeof AdminPostChargeback>

export const AdminPostChargebackMove = z
  .object({
    status: z.enum(CHARGEBACK_STATUSES).exclude(["open"]),
    note: note.optional(),
  })
  .strict()
export type AdminPostChargebackMoveType = z.infer<typeof AdminPostChargebackMove>
