import { z } from "@medusajs/framework/zod"
import { parsePaytrLira } from "./amounts"

/**
 * PayTR's answers (dev.paytr.com, 2026-10-27). Values arrive as strings or
 * numbers depending on the field and the example, so both are read as
 * text. Unknown fields are dropped; the documented ones are optional where
 * the documentation does not show them in every answer.
 */

const text = z.union([z.string(), z.number()]).transform(String)

/** Lira as PayTR writes it ("10,8", "9.76") read into kuruş; any other form fails the answer. */
const lira = z.union([z.string(), z.number()]).transform((value, ctx) => {
  try {
    return parsePaytrLira(value)
  } catch {
    ctx.addIssue({ code: "custom", message: "not a PayTR lira amount" })
    return z.NEVER
  }
})

const failure = z.object({
  status: z.enum(["error", "failed"]),
  err_no: text.optional(),
})

export const tokenResponse = z.discriminatedUnion("status", [
  z.object({ status: z.literal("success"), token: z.string().min(1).max(256) }),
  z.object({ status: z.literal("failed"), reason: z.string().max(1000).default("") }),
])

const refundEntry = z.object({
  return_amount: lira,
  return_date: text.optional(),
  reference_no: text.optional(),
})

export const statusResponse = z.discriminatedUnion("status", [
  z.object({
    status: z.literal("success"),
    payment_amount: lira,
    payment_total: lira,
    currency: z.string().max(8),
    taksit: text.optional(),
    kart_marka: z.string().max(64).optional(),
    masked_pan: z.string().max(32).optional(),
    odeme_tipi: z.string().max(32).optional(),
    test_mode: text.optional(),
    returns: z.array(refundEntry).optional(),
  }),
  failure.extend({ status: z.literal("error") }),
  failure.extend({ status: z.literal("failed") }),
])

export const refundResponse = z.discriminatedUnion("status", [
  z.object({
    status: z.literal("success"),
    is_test: text.optional(),
    merchant_oid: z.string().max(64),
    return_amount: lira,
    reference_no: text.optional(),
  }),
  failure.extend({ status: z.literal("error") }),
  failure.extend({ status: z.literal("failed") }),
])

// The shape of `oranlar` is not documented; the known answers key card
// families, then `taksit_<n>` with a rate in percent
export const installmentRatesResponse = z.discriminatedUnion("status", [
  z.object({
    status: z.literal("success"),
    max_inst_non_bus: text.optional(),
    oranlar: z.record(z.string(), z.record(z.string(), text)),
  }),
  failure.extend({ status: z.literal("error") }),
  failure.extend({ status: z.literal("failed") }),
])
