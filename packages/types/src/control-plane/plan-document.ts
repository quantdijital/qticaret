import { z } from "zod"
import { FEATURE_FLAG_KEY, LIMIT_KEYS, SUBSCRIPTION_STATUSES, TENANT_STATUSES } from "./registry"
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

/** The billing summary the shop's panel shows (adr/0061 §7); amounts in kuruş. */
const billingSummarySchema = z.strictObject({
  status: z.enum(SUBSCRIPTION_STATUSES),
  /** The open charge's due date (Europe/Istanbul calendar day), if any. */
  due_on: z.iso.date().nullable(),
  /** The last day of grace before `restricted`, while a charge is overdue. */
  grace_ends_on: z.iso.date().nullable(),
  amount: z.int().min(0).nullable(),
  currency: z.literal("TRY"),
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
  /** `owner: platform` flags only (adr/0012); which keys those are is the shop's registry. */
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
