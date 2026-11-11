import { z } from "@medusajs/framework/zod"
import { PAYMENT_INSTRUCTION_MAX, PAYMENT_METHODS } from "@qticaret/types/control-plane"
import { isDay } from "../../../../lib/billing/days"

/**
 * What the billing routes take (Ek C16), strictly. Amounts are kuruş as
 * whole numbers; days are Istanbul calendar days (`YYYY-MM-DD`).
 */

// Control and invisible format characters never make text; a reason keeps its line breaks
const CLEAN = /^[^\p{Cc}\p{Cf}\u2028\u2029]*$/u
const CLEAN_TEXT = /^(?:[^\p{Cc}\p{Cf}\u2028\u2029]|\n)*$/u

const day = z.string().refine(isDay, "cp.day_invalid")

const reason = z
  .string()
  .trim()
  .min(3, "cp.reason_required")
  .max(500)
  .regex(CLEAN_TEXT, "cp.text_invalid")

export const PAYMENT_VIEWS = ["upcoming", "overdue", "paid"] as const

/** The payments screen: which list, optionally a shop's name or address, between two days. */
export const GetPayments = z
  .object({
    view: z.enum(PAYMENT_VIEWS).default("upcoming"),
    q: z.string().trim().max(100).optional(),
    from: day.optional(),
    to: day.optional(),
    limit: z.coerce.number().int().min(1).max(100).default(50),
    offset: z.coerce.number().int().min(0).max(100_000).default(0),
  })
  .strict()
export type GetPaymentsType = z.infer<typeof GetPayments>

/** "Ödendi": the day it arrived (not after today), how, and the receipt's reference. */
export const PostChargePay = z
  .object({
    paid_on: day,
    method: z.enum(PAYMENT_METHODS),
    reference: z
      .string()
      .trim()
      .max(200)
      .regex(CLEAN, "cp.text_invalid")
      .transform((value) => (value === "" ? null : value))
      .nullable()
      .optional(),
  })
  .strict()
export type PostChargePayType = z.infer<typeof PostChargePay>

/** "Bağışla" and void: why. */
export const PostChargeReason = z.object({ reason }).strict()
export type PostChargeReasonType = z.infer<typeof PostChargeReason>

/**
 * A corrected amount (kuruş, no proration otherwise: adr/0061 §7) and why.
 * At least one kuruş (review M2): to owe nothing, staff waive the charge.
 */
export const PostChargeAmount = z
  .object({
    amount: z
      .number()
      .int()
      .max(100_000_000)
      .refine((value) => value >= 1, "cp.amount_zero"),
    reason,
  })
  .strict()
export type PostChargeAmountType = z.infer<typeof PostChargeAmount>

/** The shop's own grace days and why; null goes back to the package's. */
export const PostSubscriptionGrace = z
  .object({
    grace_days: z.number().int().min(0).max(90).nullable(),
    reason: reason.optional(),
  })
  .strict()
  .refine((body) => body.grace_days === null || body.reason !== undefined, {
    message: "cp.reason_required",
    path: ["reason"],
  })
export type PostSubscriptionGraceType = z.infer<typeof PostSubscriptionGrace>

/**
 * The platform's payment instruction (Ek C16): plain text, its line breaks
 * kept (Windows ones made plain), blank clears it.
 */
export const PostBillingSettings = z
  .object({
    payment_instruction: z
      .string()
      .transform((value) => value.replace(/\r\n?/g, "\n").trim())
      .pipe(z.string().max(PAYMENT_INSTRUCTION_MAX).regex(CLEAN_TEXT, "cp.text_invalid"))
      .transform((value) => (value === "" ? null : value))
      .nullable(),
  })
  .strict()
export type PostBillingSettingsType = z.infer<typeof PostBillingSettings>
