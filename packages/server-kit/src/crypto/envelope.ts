import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto"
import { canonicalJsonDeep } from "./canonical-json"
import { EnvelopeError, KEK_ID_PATTERN } from "./key-wrapper"
import type { KeyWrapper } from "./key-wrapper"

/**
 * Envelope encryption (adr/0061 §4.1): every record has its own random data
 * key (DEK, 32 bytes) that encrypts it with AES-256-GCM; the DEK is stored
 * wrapped under a KEK. The record's context (owner, name, version…) is
 * bound as associated data to both the data and the wrapped DEK, so a blob
 * copied to another row opens nowhere (the adr/0027 rule). Rotating the KEK
 * re-wraps the DEK only; the data is not encrypted again.
 */

export const ENVELOPE_VERSION = 1

export interface Envelope {
  readonly version: typeof ENVELOPE_VERSION
  readonly kekId: string
  /** The DEK under the KEK. */
  readonly wrappedKey: Buffer
  /** `iv | tag | ciphertext` under the DEK. */
  readonly ciphertext: Buffer
}

/** What the record is: the same values open it, any other value fails. */
export type EnvelopeContext = Readonly<Record<string, string | number>>

const ALGORITHM = "aes-256-gcm"
const IV_BYTES = 12
const TAG_BYTES = 16
const DEK_BYTES = 32

function contextAad(context: EnvelopeContext): Buffer {
  if (Object.keys(context).length === 0) {
    throw new EnvelopeError("envelope.context_required", "an envelope needs a context")
  }
  return Buffer.from(
    `qt:envelope:v${String(ENVELOPE_VERSION)}|${canonicalJsonDeep(context)}`,
    "utf8"
  )
}

export async function sealEnvelope(
  plaintext: string | Buffer,
  context: EnvelopeContext,
  wrapper: KeyWrapper
): Promise<Envelope> {
  const aad = contextAad(context)
  const dek = randomBytes(DEK_BYTES)
  try {
    const iv = randomBytes(IV_BYTES)
    const cipher = createCipheriv(ALGORITHM, dek, iv, { authTagLength: TAG_BYTES })
    cipher.setAAD(aad)
    const sealed = Buffer.concat([
      cipher.update(typeof plaintext === "string" ? Buffer.from(plaintext, "utf8") : plaintext),
      cipher.final(),
    ])
    const { kekId, wrapped } = await wrapper.wrap(dek, aad)
    return {
      version: ENVELOPE_VERSION,
      kekId,
      wrappedKey: wrapped,
      ciphertext: Buffer.concat([iv, cipher.getAuthTag(), sealed]),
    }
  } finally {
    dek.fill(0)
  }
}

export async function openEnvelope(
  envelope: Envelope,
  context: EnvelopeContext,
  wrapper: KeyWrapper
): Promise<Buffer> {
  const aad = contextAad(context)
  const { ciphertext } = envelope
  if (ciphertext.length < IV_BYTES + TAG_BYTES) {
    throw new EnvelopeError("envelope.malformed")
  }
  const dek = await wrapper.unwrap({ kekId: envelope.kekId, wrapped: envelope.wrappedKey }, aad)
  try {
    const decipher = createDecipheriv(ALGORITHM, dek, ciphertext.subarray(0, IV_BYTES), {
      authTagLength: TAG_BYTES,
    })
    decipher.setAAD(aad)
    decipher.setAuthTag(ciphertext.subarray(IV_BYTES, IV_BYTES + TAG_BYTES))
    return Buffer.concat([
      decipher.update(ciphertext.subarray(IV_BYTES + TAG_BYTES)),
      decipher.final(),
    ])
  } catch {
    throw new EnvelopeError("envelope.open_failed")
  } finally {
    dek.fill(0)
  }
}

export async function openEnvelopeText(
  envelope: Envelope,
  context: EnvelopeContext,
  wrapper: KeyWrapper
): Promise<string> {
  return (await openEnvelope(envelope, context, wrapper)).toString("utf8")
}

/** Whether the record is wrapped under an older KEK than the wrapper's current one. */
export const needsRewrap = (envelope: Envelope, wrapper: KeyWrapper): boolean =>
  envelope.kekId !== wrapper.kekId

/**
 * Wraps the record's DEK under the current KEK (the rotation job, adr/0061
 * §4.1); the ciphertext is kept as it is. `changed` is false when it already was.
 */
export async function rewrapEnvelope(
  envelope: Envelope,
  context: EnvelopeContext,
  wrapper: KeyWrapper
): Promise<{ envelope: Envelope; changed: boolean }> {
  if (!needsRewrap(envelope, wrapper)) {
    return { envelope, changed: false }
  }
  const aad = contextAad(context)
  const dek = await wrapper.unwrap({ kekId: envelope.kekId, wrapped: envelope.wrappedKey }, aad)
  try {
    const { kekId, wrapped } = await wrapper.wrap(dek, aad)
    return { envelope: { ...envelope, kekId, wrappedKey: wrapped }, changed: true }
  } finally {
    dek.fill(0)
  }
}

const PREFIX = `qtenv${String(ENVELOPE_VERSION)}`
const BASE64URL = /^[A-Za-z0-9_-]+$/

/**
 * Whether a stored text is in the serialised envelope form (any version),
 * as opposed to an older format kept beside it while records migrate
 * (adr/0027's base64 blob, whose alphabet has no dot). A newer envelope
 * version is still an envelope: `parseEnvelope` refuses it by name.
 */
export const isSerializedEnvelope = (text: string): boolean => /^qtenv\d+\./.test(text)

/** One text column: `qtenv1.<kek id>.<wrapped DEK>.<ciphertext>`, base64url parts. */
export function serializeEnvelope(envelope: Envelope): string {
  return [
    PREFIX,
    envelope.kekId,
    envelope.wrappedKey.toString("base64url"),
    envelope.ciphertext.toString("base64url"),
  ].join(".")
}

export function parseEnvelope(text: string): Envelope {
  const parts = text.split(".")
  const [prefix, kekId, wrapped, ciphertext] = parts
  if (prefix?.startsWith("qtenv") === true && prefix !== PREFIX) {
    throw new EnvelopeError("envelope.unsupported_version")
  }
  if (
    parts.length !== 4 ||
    prefix !== PREFIX ||
    kekId === undefined ||
    !KEK_ID_PATTERN.test(kekId) ||
    wrapped === undefined ||
    !BASE64URL.test(wrapped) ||
    ciphertext === undefined ||
    !BASE64URL.test(ciphertext)
  ) {
    throw new EnvelopeError("envelope.malformed")
  }
  return {
    version: ENVELOPE_VERSION,
    kekId,
    wrappedKey: Buffer.from(wrapped, "base64url"),
    ciphertext: Buffer.from(ciphertext, "base64url"),
  }
}
