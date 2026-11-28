import { z } from "zod"
import { ed25519SignatureSchema, keyIdSchema, tenantIdSchema } from "./signature"

/**
 * The support grant (adr/0061 Ek "Destek erişimi", 2026-11-28): the
 * control plane's signed, single-use permission for one of its staff to
 * open a time-limited "Platform desteği" session in one shop's panel.
 * Signed with the control plane's active key (server-kit `signDocument`,
 * purpose `support_access`), carried to the shop's panel after `#` (never
 * in a server's access log) and redeemed once at `POST /auth/support-access`.
 * Every object is strict: an unknown field fails the grant.
 */

/** The signature's purpose: a plan document never passes as a grant, nor the other way. */
export const SUPPORT_GRANT_PURPOSE = "support_access"

/** The grant's format; a shop refuses a version it does not know. */
export const SUPPORT_GRANT_VERSION = 1

/** Who the grant is for: a shop's panel, nothing else of the shop's. */
export const SUPPORT_GRANT_AUDIENCE = "shop_panel"

/** How long a session may last, and the choices the control plane offers. */
export const SUPPORT_SESSION_MAX_MINUTES = 60
export const SUPPORT_SESSION_MINUTES = [15, 30, 60] as const
export type SupportSessionMinutes = (typeof SUPPORT_SESSION_MINUTES)[number]

/** A grant must be redeemed this soon after it is issued (the link is opened at once). */
export const SUPPORT_GRANT_REDEEM_SECONDS = 5 * 60

/** The clock difference either side the shop allows on `issued_at`. */
export const SUPPORT_GRANT_MAX_SKEW_SECONDS = 5 * 60

export const SUPPORT_REASON_MIN = 10
export const SUPPORT_REASON_MAX = 500
export const SUPPORT_OPERATOR_NAME_MAX = 100

// Control and invisible format characters never reach a shop's panel or e-mail
const PLAIN_LINE = /^[^\p{Cc}\p{Cf}  ]*$/u

/** The grant's id: its single-use nonce, 16 random bytes and more in base64url. */
export const supportGrantIdSchema = z.string().regex(/^sgr_[A-Za-z0-9_-]{22,64}$/, "must be a grant id")

/** The session's actor id in the shop: `qtsup_` and the grant's random part. */
export const SUPPORT_ACTOR_PREFIX = "qtsup_"

const unixSeconds = z.int().min(1_600_000_000).max(10_000_000_000)

export const supportGrantDocumentSchema = z
  .strictObject({
    version: z.literal(SUPPORT_GRANT_VERSION),
    audience: z.literal(SUPPORT_GRANT_AUDIENCE),
    tenant_id: tenantIdSchema,
    grant_id: supportGrantIdSchema,
    operator: z.strictObject({
      /** The control plane's user id of the staff member. */
      id: z.string().regex(/^[A-Za-z0-9_-]{1,64}$/, "must be an id"),
      name: z.string().trim().min(1).max(SUPPORT_OPERATOR_NAME_MAX).regex(PLAIN_LINE),
      /** Their control plane role when the grant was issued. */
      role: z.enum(["owner", "operator"]),
    }),
    reason: z.string().trim().min(SUPPORT_REASON_MIN).max(SUPPORT_REASON_MAX).regex(PLAIN_LINE),
    /** Unix seconds. */
    issued_at: unixSeconds,
    /** Unix seconds: the session ends then, whatever happens in it (no sliding). */
    expires_at: unixSeconds,
  })
  .refine(
    (grant) =>
      grant.expires_at > grant.issued_at &&
      grant.expires_at - grant.issued_at <= SUPPORT_SESSION_MAX_MINUTES * 60,
    { message: "must last at most an hour", path: ["expires_at"] }
  )
export type SupportGrantDocument = z.infer<typeof supportGrantDocumentSchema>

/** The grant as it travels: the document and the control plane's signature over it. */
export const signedSupportGrantSchema = z.strictObject({
  document: supportGrantDocumentSchema,
  kid: keyIdSchema,
  signature: ed25519SignatureSchema,
})
export type SignedSupportGrant = z.infer<typeof signedSupportGrantSchema>

/** The encoded grant's bound: base64url of its JSON. */
export const SUPPORT_GRANT_MAX_CHARS = 4096

/** Its body at `POST /auth/support-access`. */
export const supportAccessRequestSchema = z.strictObject({
  grant: z.string().min(16).max(SUPPORT_GRANT_MAX_CHARS).regex(/^[A-Za-z0-9_-]+$/),
})
export type SupportAccessRequest = z.infer<typeof supportAccessRequestSchema>

/** `<panel origin>/support#grant=…`: the panel's own page takes it from there. */
export function supportAccessLink(panelOrigin: string, encodedGrant: string): string {
  return `${panelOrigin}/support#${new URLSearchParams({ grant: encodedGrant }).toString()}`
}
