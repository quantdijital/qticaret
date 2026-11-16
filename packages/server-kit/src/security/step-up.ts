import { hkdfSync, randomBytes } from "node:crypto"
import { decryptPii, encryptPii } from "../crypto/pii"

/**
 * A step-up proof (adr/0061 §3.5, Ek C4): after a person proves themselves
 * again (a 2FA code), a short-lived token that lets the same person, in the
 * same session, make sensitive changes for a few minutes. Sealed with
 * AES-256-GCM; the binding (who, which session) is the associated data, so
 * a token opens for nobody else. Stateless: nothing to store, and nothing
 * to read it but the key.
 */

export const STEP_UP_TTL_MS = 5 * 60 * 1000
const VERSION = "qt.step_up.v1"
// A sealed payload is ~100 characters; anything much longer is not ours
const MAX_TOKEN = 512

export type StepUpCheck = "valid" | "expired" | "invalid"

/** The step-up sealing key, derived from an app key so the two never mix (HKDF-SHA256). */
export function stepUpKey(appKey: Buffer): Buffer {
  return Buffer.from(hkdfSync("sha256", appKey, Buffer.alloc(0), VERSION, 32))
}

const context = (binding: string) => `${VERSION}\n${binding}`

/** A new proof for `binding`, good for `ttlMs`. */
export function issueStepUpProof(
  binding: string,
  key: Buffer,
  now: number = Date.now(),
  ttlMs: number = STEP_UP_TTL_MS
): { token: string; expiresAt: number } {
  const expiresAt = now + ttlMs
  const sealed = encryptPii(
    JSON.stringify({ x: expiresAt, n: randomBytes(8).toString("hex") }),
    key,
    context(binding)
  )
  return { token: Buffer.from(sealed, "base64").toString("base64url"), expiresAt }
}

/** Whether `token` is a proof for `binding` that has not run out. Never throws. */
export function checkStepUpProof(
  token: string,
  binding: string,
  key: Buffer,
  now: number = Date.now()
): StepUpCheck {
  if (token.length === 0 || token.length > MAX_TOKEN || !/^[A-Za-z0-9_-]+$/.test(token)) {
    return "invalid"
  }
  try {
    const bytes = Buffer.from(token, "base64url")
    // One spelling per proof: a last character's unused bits set, or a stray one, open nothing
    if (bytes.toString("base64url") !== token) {
      return "invalid"
    }
    const sealed = bytes.toString("base64")
    const payload = JSON.parse(decryptPii(sealed, key, context(binding))) as { x?: unknown }
    if (typeof payload.x !== "number") {
      return "invalid"
    }
    return payload.x > now ? "valid" : "expired"
  } catch {
    return "invalid"
  }
}
