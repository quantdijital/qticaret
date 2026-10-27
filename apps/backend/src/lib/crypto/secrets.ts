import { createHash } from "node:crypto"
import { decryptPii, encryptPii } from "./pii"

/**
 * Stored provider secrets (adr/0027): the same AES-256-GCM box as personal
 * identifiers, under a key of their own (`CREDENTIALS_ENCRYPTION_KEY`).
 * `context` is bound as associated data, so a blob copied to another
 * provider's row does not open.
 */
export const sealSecret = encryptPii
export const openSecret = decryptPii

/**
 * Names the key a blob was sealed with, so a changed key is told apart
 * from a damaged blob. 64 bits of a hash of a random 256-bit key say
 * nothing usable about it.
 */
export function keyFingerprint(key: Buffer): string {
  return createHash("sha256").update(key).digest("hex").slice(0, 16)
}
