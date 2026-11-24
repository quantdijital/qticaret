import { z } from "zod"
import { BILLING_PERIODS } from "./registry"
import { ed25519SignatureSchema, keyIdSchema, tenantIdSchema } from "./signature"

/**
 * A shop's own payment history (adr/0061 Ek C20): `GET
 * /tenant-api/v1/billing`, a signed request like the plan's pull. Its
 * charges only, the latest first, at most `BILLING_HISTORY_LIMIT`; never
 * a voided one (a correction staff made). What staff wrote about a charge
 * (the bank reference, who settled it, why) stays at the control plane.
 * Strict at every level: an unknown field fails the answer.
 */

/** The signature's purpose over the answer and the request's nonce. */
export const BILLING_HISTORY_PURPOSE = "billing_history"

/** Two years of monthly charges. */
export const BILLING_HISTORY_LIMIT = 24

/** The answer is held to this before it is parsed. */
export const BILLING_HISTORY_MAX_BYTES = 24 * 1024

/** The charge statuses a shop sees; `void` is left out. */
export const BILLING_RECORD_STATUSES = ["open", "paid", "waived"] as const
export type BillingRecordStatus = (typeof BILLING_RECORD_STATUSES)[number]

// Control and invisible format characters (bidi included) never reach a shop's panel
const PLAIN_LINE = /^[^\p{Cc}\p{Cf}\p{Zl}\p{Zp}]*$/u

/** An invoice's PDF: https, no credentials, at most 500 characters. */
export const invoiceUrlSchema = z
  .url({ protocol: /^https$/, error: "must be an https URL" })
  .max(500)
  .refine((value) => {
    const url = new URL(value)
    return url.username === "" && url.password === ""
  }, "must not carry credentials")

export const billingRecordSchema = z.strictObject({
  id: z.string().regex(/^chg_[0-9A-Za-z]{1,60}$/, "must be a charge id"),
  period: z.enum(BILLING_PERIODS),
  /** The period's first day and the next period's first day (Istanbul days). */
  period_start: z.iso.date(),
  period_end: z.iso.date(),
  due_on: z.iso.date(),
  /** Kuruş. */
  amount: z.int().min(0),
  currency: z.literal("TRY"),
  status: z.enum(BILLING_RECORD_STATUSES),
  paid_on: z.iso.date().nullable(),
  invoice_number: z.string().min(1).max(64).regex(PLAIN_LINE).nullable(),
  invoice_url: invoiceUrlSchema.nullable(),
})
export type BillingRecord = z.infer<typeof billingRecordSchema>

export const billingHistorySchema = z.strictObject({
  tenant_id: tenantIdSchema,
  records: z.array(billingRecordSchema).max(BILLING_HISTORY_LIMIT),
})
export type BillingHistory = z.infer<typeof billingHistorySchema>

/** The answer: the history and the control plane's signature over it and the nonce. */
export const billingHistoryResponseSchema = z.strictObject({
  history: billingHistorySchema,
  binding: z.strictObject({ kid: keyIdSchema, signature: ed25519SignatureSchema }),
})
export type BillingHistoryResponse = z.infer<typeof billingHistoryResponseSchema>

/** What the binding signs: the request's nonce and the history as sent. */
export const billingHistoryBinding = (nonce: string, history: BillingHistory) => ({
  nonce,
  history,
})
