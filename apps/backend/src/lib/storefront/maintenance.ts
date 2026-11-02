import { randomBytes } from "node:crypto"
import { previewSigner } from "../content/preview-token"
import type { PreviewTokenParts } from "../content/preview-token"

/**
 * A link past the maintenance page (adr/0053): `/bakim/gir?t=<token>`, the
 * token `mnb_<random>.<end>.<mac>` signed under its own context and bound to
 * the maintenance section's version, so any save of the section (turning it
 * off and on again too) ends every link made before. For a week; nothing is
 * stored. The storefront checks it with the backend, then keeps it in an
 * httpOnly cookie of its own.
 */

export const BYPASS_DAYS = 7

/** The storefront's page that takes the link and sets its cookie. */
export const BYPASS_PATH = "/bakim/gir"

// 12 random bytes: 16 base64url characters, a name for the link in no table
const signer = previewSigner("maintenance-bypass:v1", "mnb_[0-9A-Za-z_-]{16}", BYPASS_DAYS * 24)

/** A new link's token for the section as saved now (its `version`). */
export function bypassToken(
  key: Buffer,
  version: number,
  now = new Date()
): { token: string; expires_at: Date } {
  return signer.token(
    key,
    { id: `mnb_${randomBytes(12).toString("base64url")}`, updated_at: version },
    now
  )
}

/** The token's parts while well formed and before its end: worth a look at the section. */
export const bypassParts = (token: string, now = new Date()): PreviewTokenParts | null =>
  signer.parts(token, now)

/** Whether the token was made for the section at `version`. */
export const bypassOpens = (key: Buffer, parts: PreviewTokenParts, version: number): boolean =>
  signer.opens(key, parts, version)
