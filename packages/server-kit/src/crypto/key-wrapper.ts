import { createCipheriv, createDecipheriv, createHmac, randomBytes } from "node:crypto"
import { parseKey } from "./pii"

/**
 * Key-encryption keys for envelope encryption (adr/0061 §4.1). A wrapper
 * seals a record's data key (DEK) under its current KEK and opens one sealed
 * under any KEK it still holds, so a new KEK is added, records are re-wrapped
 * and the old one is dropped without downtime. The local wrapper keeps the
 * KEKs in process memory (`CP_MASTER_KEY`, `CREDENTIALS_ENCRYPTION_KEYS`);
 * OpenBao Transit implements the same interface later (F16).
 */

export type EnvelopeErrorCode =
  | "envelope.malformed"
  | "envelope.unsupported_version"
  | "envelope.unknown_kek"
  | "envelope.open_failed"
  | "envelope.context_required"
  | "envelope.invalid_kek"

/** Never carries a key, a data key or plaintext; `code` says what went wrong. */
export class EnvelopeError extends Error {
  override readonly name = "EnvelopeError"
  readonly code: EnvelopeErrorCode

  constructor(code: EnvelopeErrorCode, message: string = code) {
    super(message)
    this.code = code
  }
}

export interface WrappedKey {
  /** The KEK that wrapped it; serialised next to the record. */
  readonly kekId: string
  readonly wrapped: Buffer
}

export interface KeyWrapper {
  /** The KEK new records are wrapped with. */
  readonly kekId: string
  /** Whether a key wrapped under `kekId` can still be opened. */
  canUnwrap(kekId: string): boolean
  /** `aad` binds the wrapped key to its record: it opens with the same bytes only. */
  wrap(dek: Buffer, aad: Buffer): Promise<WrappedKey>
  unwrap(key: WrappedKey, aad: Buffer): Promise<Buffer>
}

const ALGORITHM = "aes-256-gcm"
const IV_BYTES = 12
const TAG_BYTES = 16
const KEY_BYTES = 32

/** Ids are written into serialised records, so they stay short and dot-free. */
export const KEK_ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/

/** A KEK's id: keyed and domain-separated, so it says nothing about the key. */
export function kekFingerprint(kek: Buffer): string {
  return createHmac("sha256", kek).update("qt:envelope:kek-id").digest("hex").slice(0, 16)
}

const wrapAad = (kekId: string, aad: Buffer): Buffer =>
  Buffer.concat([Buffer.from(`qt:envelope:dek:v1|${kekId}|`, "utf8"), aad])

/**
 * Wraps with the first KEK and unwraps with any of them: list the new key
 * first while a rotation runs, the old one after it, and remove the old one
 * once every record is re-wrapped (`rewrapEnvelope`).
 */
export function createLocalKeyWrapper(keks: readonly Buffer[]): KeyWrapper {
  const keys = new Map<string, Buffer>()
  for (const kek of keks) {
    if (kek.length !== KEY_BYTES) {
      throw new EnvelopeError("envelope.invalid_kek", "a KEK must be 32 bytes")
    }
    const id = kekFingerprint(kek)
    if (keys.has(id)) {
      throw new EnvelopeError("envelope.invalid_kek", "the same KEK is listed twice")
    }
    keys.set(id, Buffer.from(kek))
  }
  const [first] = keys
  if (first === undefined) {
    throw new EnvelopeError("envelope.invalid_kek", "at least one KEK is required")
  }
  const [current, currentKek] = first

  return {
    kekId: current,
    canUnwrap: (kekId) => keys.has(kekId),
    wrap(dek, aad) {
      const iv = randomBytes(IV_BYTES)
      const cipher = createCipheriv(ALGORITHM, currentKek, iv, { authTagLength: TAG_BYTES })
      cipher.setAAD(wrapAad(current, aad))
      const sealed = Buffer.concat([cipher.update(dek), cipher.final()])
      return Promise.resolve({
        kekId: current,
        wrapped: Buffer.concat([iv, cipher.getAuthTag(), sealed]),
      })
    },
    unwrap({ kekId, wrapped }, aad) {
      const kek = keys.get(kekId)
      if (kek === undefined) {
        return Promise.reject(new EnvelopeError("envelope.unknown_kek"))
      }
      if (wrapped.length !== IV_BYTES + TAG_BYTES + KEY_BYTES) {
        return Promise.reject(new EnvelopeError("envelope.malformed"))
      }
      try {
        const decipher = createDecipheriv(ALGORITHM, kek, wrapped.subarray(0, IV_BYTES), {
          authTagLength: TAG_BYTES,
        })
        decipher.setAAD(wrapAad(kekId, aad))
        decipher.setAuthTag(wrapped.subarray(IV_BYTES, IV_BYTES + TAG_BYTES))
        return Promise.resolve(
          Buffer.concat([decipher.update(wrapped.subarray(IV_BYTES + TAG_BYTES)), decipher.final()])
        )
      } catch {
        // Wrong KEK, another record's associated data or a damaged blob
        return Promise.reject(new EnvelopeError("envelope.open_failed"))
      }
    },
  }
}

/**
 * KEKs from a comma-separated list of 64-hex-character keys, newest first
 * (`CREDENTIALS_ENCRYPTION_KEYS`); the message names the variable, never a value.
 */
export function parseKekList(value: string, name: string): Buffer[] {
  const parts = value
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part !== "")
  if (parts.length === 0) {
    throw new EnvelopeError("envelope.invalid_kek", `${name} must list at least one key`)
  }
  return parts.map((part) => parseKey(part, name))
}
