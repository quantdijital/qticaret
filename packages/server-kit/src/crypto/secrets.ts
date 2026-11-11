import { createHmac } from "node:crypto"
import { decryptPii, encryptPii } from "./pii"

/**
 * Stored provider secrets (adr/0027): the same AES-256-GCM box as personal
 * identifiers, under a key of their own (`CREDENTIALS_ENCRYPTION_KEY`).
 * `context` is bound as associated data, so a blob copied to another
 * provider's row does not open. Since adr/0061 Ek C17 new values are
 * envelopes (`./envelope`); this box is still read for rows sealed before,
 * which are upgraded as they are read.
 */
export const sealSecret = encryptPii
export const openSecret = decryptPii

/**
 * Names the key a blob was sealed with, so a changed key is told apart
 * from a damaged blob. Keyed and domain-separated, so it says nothing
 * about the key itself.
 */
export function keyFingerprint(key: Buffer): string {
  return createHmac("sha256", key).update("qt:credentials:key-id").digest("hex").slice(0, 16)
}
