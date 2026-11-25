import { createHash, randomBytes, sign, verify, type KeyObject } from "node:crypto"
import { DUMMY_PUBLIC_KEY } from "./dummy-key"
import type { Ed25519Signer } from "./ed25519"
import type { NonceStore } from "./nonce-store"

/**
 * Signed requests between a shop and the control plane (adr/0061 §3.2): an
 * Ed25519 signature over the method, path, tenant, time, a one-time nonce,
 * the key id and the body's SHA-256. The receiver refuses a timestamp more
 * than 5 minutes off and a nonce it has seen in the last 11 minutes. No
 * secret is shared: the receiver holds the sender's public key only.
 */

export const SIGNED_REQUEST_SCHEME = "QT-ED25519-V1"

/** Lowercase, as Node's `IncomingHttpHeaders` holds them. */
export const SIGNED_REQUEST_HEADERS = {
  tenant: "x-qt-tenant",
  keyId: "x-qt-key-id",
  timestamp: "x-qt-timestamp",
  nonce: "x-qt-nonce",
  signature: "x-qt-signature",
} as const

export const DEFAULT_MAX_SKEW_SECONDS = 5 * 60
// Strictly longer than the 10 minutes a timestamp is accepted over (C9 review L2)
export const DEFAULT_NONCE_TTL_SECONDS = 11 * 60

export type SignedRequestErrorCode =
  | "signature.missing_header"
  | "signature.malformed"
  | "signature.stale"
  | "signature.unknown_key"
  | "signature.invalid"
  | "signature.replayed"

const ID = /^[A-Za-z0-9_-]{1,64}$/
const NONCE = /^[A-Za-z0-9_-]{16,64}$/
const TIMESTAMP = /^[0-9]{1,12}$/
const SIGNATURE = /^[A-Za-z0-9_-]{86}$/
const METHOD = /^[A-Z]{3,10}$/
// The request target as sent: path and query, nothing that could end a line
const PATH = /^\/[^\s]*$/

export interface RequestParts {
  method: string
  /** Path and query string exactly as on the request line (`req.originalUrl`). */
  path: string
  tenantId: string
  timestamp: number
  nonce: string
  kid: string
  body: string | Buffer
}

export const bodyDigest = (body: string | Buffer): string =>
  createHash("sha256").update(body).digest("base64url")

/** The bytes both sides sign; one field per line, none of which can hold a newline. */
export function canonicalRequest(parts: RequestParts): string {
  return [
    SIGNED_REQUEST_SCHEME,
    parts.method,
    parts.path,
    parts.tenantId,
    String(parts.timestamp),
    parts.nonce,
    parts.kid,
    bodyDigest(parts.body),
  ].join("\n")
}

export interface SignRequestInput {
  method: string
  path: string
  tenantId: string
  body: string | Buffer
  signer: Ed25519Signer
  /** Milliseconds since the epoch; tests pass a fixed time. */
  now?: number
  /** Tests pass a fixed nonce; otherwise 16 random bytes. */
  nonce?: string
}

/** The headers to send with the request. */
export function signRequest(input: SignRequestInput): Record<string, string> {
  const method = input.method.toUpperCase()
  const timestamp = Math.floor((input.now ?? Date.now()) / 1000)
  const nonce = input.nonce ?? randomBytes(16).toString("base64url")
  if (
    !METHOD.test(method) ||
    !PATH.test(input.path) ||
    !ID.test(input.tenantId) ||
    !NONCE.test(nonce)
  ) {
    throw new TypeError("signRequest: method, path, tenant id or nonce is malformed")
  }
  const parts = { ...input, method, timestamp, nonce, kid: input.signer.kid }
  const signature = sign(null, Buffer.from(canonicalRequest(parts)), input.signer.privateKey)
  return {
    [SIGNED_REQUEST_HEADERS.tenant]: input.tenantId,
    [SIGNED_REQUEST_HEADERS.keyId]: input.signer.kid,
    [SIGNED_REQUEST_HEADERS.timestamp]: String(timestamp),
    [SIGNED_REQUEST_HEADERS.nonce]: nonce,
    [SIGNED_REQUEST_HEADERS.signature]: signature.toString("base64url"),
  }
}

export interface IncomingSignedRequest {
  method: string
  path: string
  headers: Readonly<Record<string, string | readonly string[] | undefined>>
  /** The raw body bytes as received, before any parsing. */
  body: string | Buffer
}

export interface VerifyRequestOptions {
  /** The sender's public key by key id; `undefined` when it is unknown. */
  publicKey: (
    kid: string,
    tenantId: string
  ) => KeyObject | undefined | Promise<KeyObject | undefined>
  nonces: NonceStore
  now?: () => number
  maxSkewSeconds?: number
  nonceTtlSeconds?: number
}

export type VerifiedRequest =
  | { ok: true; tenantId: string; kid: string; timestamp: number; nonce: string }
  | { ok: false; code: SignedRequestErrorCode }

const fail = (code: SignedRequestErrorCode): VerifiedRequest => ({ ok: false, code })

function readHeaders(
  headers: IncomingSignedRequest["headers"]
): Record<keyof typeof SIGNED_REQUEST_HEADERS, string> | SignedRequestErrorCode {
  const values: Partial<Record<keyof typeof SIGNED_REQUEST_HEADERS, string>> = {}
  for (const [field, name] of Object.entries(SIGNED_REQUEST_HEADERS)) {
    const value = headers[name]
    if (value === undefined || value === "") {
      return "signature.missing_header"
    }
    if (typeof value !== "string") {
      return "signature.malformed"
    }
    values[field as keyof typeof SIGNED_REQUEST_HEADERS] = value
  }
  return values as Record<keyof typeof SIGNED_REQUEST_HEADERS, string>
}

/**
 * What can be refused of a signed request before its body is read: the
 * headers' presence and shape and the time, the same checks (and codes)
 * `verifySignedRequest` starts with; null when they pass. No key is looked
 * up, so an unknown key still answers only after the body, as a wrong
 * signature does. For a route that reads a large body (the AI gateway's).
 */
export function precheckSignedRequest(
  headers: IncomingSignedRequest["headers"],
  options: Pick<VerifyRequestOptions, "now" | "maxSkewSeconds"> = {}
): SignedRequestErrorCode | null {
  const values = readHeaders(headers)
  if (typeof values === "string") {
    return values
  }
  if (
    !ID.test(values.tenant) ||
    !ID.test(values.keyId) ||
    !TIMESTAMP.test(values.timestamp) ||
    !NONCE.test(values.nonce) ||
    !SIGNATURE.test(values.signature)
  ) {
    return "signature.malformed"
  }
  const now = Math.floor((options.now ?? Date.now)() / 1000)
  const skew = options.maxSkewSeconds ?? DEFAULT_MAX_SKEW_SECONDS
  return Math.abs(now - Number(values.timestamp)) > skew ? "signature.stale" : null
}

/**
 * Checks shape, time, key and signature, and only then claims the nonce, so
 * an unsigned request cannot use up someone's nonces. Never throws on input.
 */
export async function verifySignedRequest(
  request: IncomingSignedRequest,
  options: VerifyRequestOptions
): Promise<VerifiedRequest> {
  const maxSkew = options.maxSkewSeconds ?? DEFAULT_MAX_SKEW_SECONDS
  const nonceTtl = options.nonceTtlSeconds ?? DEFAULT_NONCE_TTL_SECONDS
  if (nonceTtl <= 2 * maxSkew + 1) {
    // A nonce forgotten while its timestamp is still accepted could be replayed;
    // a second either side covers the seconds the timestamps are rounded to
    throw new RangeError("nonceTtlSeconds must be more than twice maxSkewSeconds")
  }
  const headers = readHeaders(request.headers)
  if (typeof headers === "string") {
    return fail(headers)
  }
  const method = request.method.toUpperCase()
  if (
    !METHOD.test(method) ||
    !PATH.test(request.path) ||
    !ID.test(headers.tenant) ||
    !ID.test(headers.keyId) ||
    !TIMESTAMP.test(headers.timestamp) ||
    !NONCE.test(headers.nonce) ||
    !SIGNATURE.test(headers.signature)
  ) {
    return fail("signature.malformed")
  }
  const timestamp = Number(headers.timestamp)
  const now = Math.floor((options.now ?? Date.now)() / 1000)
  if (Math.abs(now - timestamp) > maxSkew) {
    return fail("signature.stale")
  }
  const key = await options.publicKey(headers.keyId, headers.tenant)
  const message = canonicalRequest({
    method,
    path: request.path,
    tenantId: headers.tenant,
    timestamp,
    nonce: headers.nonce,
    kid: headers.keyId,
    body: request.body,
  })
  let valid: boolean
  try {
    // No key: the same work against a key nobody holds (C9 review L6)
    valid = verify(
      null,
      Buffer.from(message),
      key ?? DUMMY_PUBLIC_KEY,
      Buffer.from(headers.signature, "base64url")
    )
  } catch {
    // A key of another type
    valid = false
  }
  if (key === undefined) {
    return fail("signature.unknown_key")
  }
  if (!valid) {
    return fail("signature.invalid")
  }
  if (!(await options.nonces.claim(`${headers.tenant}:${headers.nonce}`, nonceTtl))) {
    return fail("signature.replayed")
  }
  return { ok: true, tenantId: headers.tenant, kid: headers.keyId, timestamp, nonce: headers.nonce }
}
