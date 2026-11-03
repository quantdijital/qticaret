import { createHash, randomBytes } from "node:crypto"
import { previewSigner } from "../content/preview-token"
import type { PreviewTokenParts } from "../content/preview-token"

/**
 * A payment link's token (adr/0051 §3): `pl_<random>.<end>.<mac>`, signed
 * with `PII_HASH_KEY` under its own context, so a token no one was given
 * is turned away before any table is read. The end it carries is the
 * longest a link may live (seven days from its making); the link's own
 * end, shorter or extended up to that, is the record's. The record keeps
 * the token's SHA-256 to find it by, and the token sealed for sharing again.
 */

/** The longest a link opens: seven days (adr/0051 §3). */
export const MAX_LINK_HOURS = 7 * 24
/** Unless staff say otherwise: three days. */
export const DEFAULT_LINK_HOURS = 72
export const MIN_LINK_HOURS = 1

/** The storefront's page: `/ode/<token>`. */
export const PAYMENT_LINK_PATH = "/ode"

// 16 random bytes: 22 base64url characters, a name for the link in no table
const signer = previewSigner("payment-link:v1", "pl_[0-9A-Za-z_-]{22}", MAX_LINK_HOURS)

// Nothing to bind beyond the link's own name: what ends a link is its record
const UNBOUND = 0

/** A new link's token, and the latest moment it can ever open. */
export function newPaymentLinkToken(
  key: Buffer,
  now = new Date()
): { token: string; ends_at: Date } {
  const made = signer.token(
    key,
    { id: `pl_${randomBytes(16).toString("base64url")}`, updated_at: UNBOUND },
    now
  )
  return { token: made.token, ends_at: made.expires_at }
}

/**
 * Whether the token is one of ours, well formed, signed and before its
 * end: only then is it worth looking up. Anything else is answered as
 * an unknown link, with no table read.
 */
export function paymentLinkTokenValid(key: Buffer, token: string, now = new Date()): boolean {
  const parts: PreviewTokenParts | null = signer.parts(token, now)
  return parts !== null && signer.opens(key, parts, UNBOUND)
}

/** What the record keeps to find the link by. */
export const paymentLinkTokenHash = (token: string): string =>
  createHash("sha256").update(token, "utf8").digest("hex")

/** The link as the customer opens it. */
export const paymentLinkUrl = (storefrontUrl: string, token: string): string =>
  `${storefrontUrl}${PAYMENT_LINK_PATH}/${encodeURIComponent(token)}`

/** A token as a route may take it: the shape alone, before its signature is checked. */
export const PAYMENT_LINK_TOKEN_SHAPE = /^pl_[0-9A-Za-z_-]{22}\.[0-9a-z]{1,12}\.[\w-]{43}$/
