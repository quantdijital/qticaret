import { createCipheriv, createDecipheriv, createHmac, randomBytes } from "node:crypto"

/**
 * Application-level protection for personal identifiers (docs/04, adr/0009):
 * AES-256-GCM for storage, HMAC-SHA256 for equality lookups without
 * decrypting. Plaintext and keys never leave these functions in errors.
 */

const ALGORITHM = "aes-256-gcm"
const IV_BYTES = 12
const TAG_BYTES = 16
const KEY_BYTES = 32

export class PiiKeyError extends Error {
  override readonly name = "PiiKeyError"
}

/** Parses a 64-character hex key; the message never contains the value. */
export function parseKey(hex: string, name: string): Buffer {
  const key = /^[0-9a-fA-F]{64}$/.test(hex) ? Buffer.from(hex, "hex") : null
  if (key?.length !== KEY_BYTES) {
    throw new PiiKeyError(`${name} must be 32 bytes as 64 hex characters`)
  }
  return key
}

/**
 * Encrypts to `base64(iv | tag | ciphertext)`. `context` is bound as
 * associated data, so a ciphertext copied to another field fails to decrypt.
 */
export function encryptPii(plaintext: string, key: Buffer, context: string): string {
  const iv = randomBytes(IV_BYTES)
  const cipher = createCipheriv(ALGORITHM, key, iv, { authTagLength: TAG_BYTES })
  cipher.setAAD(Buffer.from(context, "utf8"))
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()])
  return Buffer.concat([iv, cipher.getAuthTag(), ciphertext]).toString("base64")
}

export function decryptPii(payload: string, key: Buffer, context: string): string {
  const data = Buffer.from(payload, "base64")
  if (data.length <= IV_BYTES + TAG_BYTES) {
    throw new PiiKeyError("encrypted value is malformed")
  }
  const decipher = createDecipheriv(ALGORITHM, key, data.subarray(0, IV_BYTES), {
    authTagLength: TAG_BYTES,
  })
  decipher.setAAD(Buffer.from(context, "utf8"))
  decipher.setAuthTag(data.subarray(IV_BYTES, IV_BYTES + TAG_BYTES))
  return Buffer.concat([
    decipher.update(data.subarray(IV_BYTES + TAG_BYTES)),
    decipher.final(),
  ]).toString("utf8")
}

/** Keyed hash for finding equal values; useless for brute force without the key. */
export function hashPii(value: string, key: Buffer, context: string): string {
  return createHmac("sha256", key).update(`${context}:${value}`, "utf8").digest("hex")
}
