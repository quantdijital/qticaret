import { z } from "zod"
import {
  BILLING_PERIODS,
  FEATURE_FLAG_KEY,
  LIMIT_KEYS,
  SUBSCRIPTION_STATUSES,
  TENANT_STATUSES,
} from "./registry"
import type { LimitKey } from "./registry"
import { ed25519SignatureSchema, keyIdSchema, tenantIdSchema } from "./signature"

/**
 * The plan document (adr/0061 §3.2): what the control plane says a shop may
 * do. Signed by the control plane, pushed to `POST /hooks/control-plane/plan`
 * and served by `GET /tenant-api/v1/plan`. It holds no secret and no
 * personal data. Every object is strict: an unknown field fails the
 * document, so neither side reads a field the other did not mean.
 */

/** The signature's purpose (server-kit `signDocument`). */
export const PLAN_DOCUMENT_PURPOSE = "plan"

/** The document format; a shop refuses a version it does not know. */
export const PLAN_DOCUMENT_VERSION = 1

/** `null` is unlimited. */
const limitValue = z.int().min(0).nullable()

const limitsSchema = z.strictObject(
  Object.fromEntries(LIMIT_KEYS.map((key) => [key, limitValue])) as Record<
    LimitKey,
    typeof limitValue
  >
)

/** A package's name as the shop shows it (Ek C16): a line of plain text. */
export const PACKAGE_NAME_MAX = 100

/** How to pay, as the platform writes it (Ek C16): plain text, lines kept. */
export const PAYMENT_INSTRUCTION_MAX = 1000

// Control and invisible format characters never reach a shop's panel; line breaks may
const PLAIN_LINE = /^[^\p{Cc}\p{Cf}\u2028\u2029]*$/u
const PLAIN_TEXT = /^(?:[^\p{Cc}\p{Cf}\u2028\u2029]|\n)*$/u

/**
 * The billing summary the shop's panel shows (adr/0061 §7); amounts in
 * kuruş. `package_name` and `payment_instruction` came with C16 and are
 * optional, so a shop takes documents with and without them while the
 * fleet is updated (Ek C16); the object stays strict.
 */
const billingSummarySchema = z.strictObject({
  status: z.enum(SUBSCRIPTION_STATUSES),
  /** The open charge's due date (Europe/Istanbul calendar day), if any. */
  due_on: z.iso.date().nullable(),
  /** The last day of grace before `restricted`, while a charge is overdue. */
  grace_ends_on: z.iso.date().nullable(),
  amount: z.int().min(0).nullable(),
  currency: z.literal("TRY"),
  package_name: z.string().min(1).max(PACKAGE_NAME_MAX).regex(PLAIN_LINE).optional(),
  payment_instruction: z
    .string()
    .min(1)
    .max(PAYMENT_INSTRUCTION_MAX)
    .regex(PLAIN_TEXT)
    .nullable()
    .optional(),
  /**
   * The subscription's terms (Ek C20), optional as C16's: what one period
   * costs (`price`, kuruş, the running period's; the package's before a
   * subscription) and how long it is; the trial's first and next-paid day
   * (both null without a trial). A shop takes documents without them.
   */
  period: z.enum(BILLING_PERIODS).optional(),
  price: z.int().min(0).nullable().optional(),
  trial_started_on: z.iso.date().nullable().optional(),
  trial_ends_on: z.iso.date().nullable().optional(),
})

export const planDocumentSchema = z.strictObject({
  version: z.literal(PLAN_DOCUMENT_VERSION),
  tenant_id: tenantIdSchema,
  /** Grows with every document for the shop; see `comparePlanSerial`. */
  serial: z.int().positive(),
  issued_at: z.iso.datetime(),
  status: z.enum(TENANT_STATUSES),
  package_code: z.string().regex(/^[a-z0-9][a-z0-9_-]{0,63}$/, "must be a package code"),
  /** The package's limits with the shop's overrides already applied. */
  limits: limitsSchema,
  /** `owner: platform` flags only (adr/0012, `PLATFORM_FLAGS`); a key the shop does not know is ignored there. */
  platform_flags: z
    .record(z.string().regex(FEATURE_FLAG_KEY, "must be a flag key"), z.boolean())
    .refine((flags) => Object.keys(flags).length <= 100, "has too many flags"),
  billing: billingSummarySchema,
})
export type PlanDocument = z.infer<typeof planDocumentSchema>
export type PlanLimits = PlanDocument["limits"]
export type PlanBillingSummary = PlanDocument["billing"]

/** The document as it travels and as both sides store it. */
export const signedPlanDocumentSchema = z.strictObject({
  document: planDocumentSchema,
  kid: keyIdSchema,
  signature: ed25519SignatureSchema,
})
export type SignedPlanDocument = z.infer<typeof signedPlanDocumentSchema>

/** A push's body is held to this before it is parsed (adr/0061 §3.2). */
export const PLAN_DOCUMENT_MAX_BYTES = 16 * 1024

/**
 * The pull's answer (adr/0061 Ek C9, review L3): the stored document as
 * pushed, and a binding the control plane signs over the request's own
 * nonce and that document. A shop accepts a pulled document only when the
 * binding is for the nonce it just sent: an old or replayed answer, or one
 * for another request, is refused, so only a fresh pull proves the shop
 * is still in touch.
 */
export const PLAN_PULL_PURPOSE = "plan_pull"

export const planPullResponseSchema = z.strictObject({
  plan: signedPlanDocumentSchema,
  binding: z.strictObject({ kid: keyIdSchema, signature: ed25519SignatureSchema }),
})
export type PlanPullResponse = z.infer<typeof planPullResponseSchema>

/** What the binding signs: the request's nonce, the shop, the serial and the document's signature. */
export function planPullBinding(nonce: string, signed: SignedPlanDocument) {
  return {
    nonce,
    tenant_id: signed.document.tenant_id,
    serial: signed.document.serial,
    document_signature: signed.signature,
  }
}

/**
 * The serial rule (adr/0061 §3.2): a greater serial replaces the stored
 * document; the same serial changes nothing (a repeated push); a smaller
 * one is an old document replayed and is refused.
 */
export function comparePlanSerial(
  stored: number | null,
  incoming: number
): "newer" | "same" | "stale" {
  if (stored === null || incoming > stored) {
    return "newer"
  }
  return incoming === stored ? "same" : "stale"
}
