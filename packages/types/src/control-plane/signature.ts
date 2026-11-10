import { z } from "zod"

/**
 * The signature contract between the control plane and a shop (adr/0061
 * §3.2 and its C1 Ek). `@qticaret/server-kit` signs and verifies; these
 * schemas say what a well-formed value is, for routes and tests.
 */

/** Ed25519 over the request: method, path, tenant, time, nonce, kid, body hash. */
export const SIGNED_REQUEST_SCHEME = "QT-ED25519-V1"
/** Ed25519 over a document's purpose and its deep canonical JSON. */
export const SIGNED_DOCUMENT_SCHEME = "QT-ED25519-DOC-V1"

/** Lowercase, as Node's `IncomingHttpHeaders` holds them. */
export const SIGNED_REQUEST_HEADERS = {
  tenant: "x-qt-tenant",
  keyId: "x-qt-key-id",
  timestamp: "x-qt-timestamp",
  nonce: "x-qt-nonce",
  signature: "x-qt-signature",
} as const

/** The receiver's window either side of its clock, and how long it remembers a nonce. */
export const SIGNED_REQUEST_MAX_SKEW_SECONDS = 5 * 60
export const SIGNED_REQUEST_NONCE_TTL_SECONDS = 10 * 60

/** `ten_` and the rest of the control plane's id. */
export const tenantIdSchema = z.string().regex(/^ten_[0-9A-Za-z]{1,60}$/, "must be a tenant id")

/** 16 hex characters derived from the public key (server-kit `ed25519KeyId`). */
export const keyIdSchema = z.string().regex(/^[0-9a-f]{16}$/, "must be a key id")

/** 64 bytes in base64url. */
export const ed25519SignatureSchema = z
  .string()
  .regex(/^[A-Za-z0-9_-]{86}$/, "must be an Ed25519 signature in base64url")

export const signedRequestHeadersSchema = z.strictObject({
  [SIGNED_REQUEST_HEADERS.tenant]: tenantIdSchema,
  [SIGNED_REQUEST_HEADERS.keyId]: keyIdSchema,
  [SIGNED_REQUEST_HEADERS.timestamp]: z.string().regex(/^[0-9]{1,12}$/, "must be Unix seconds"),
  [SIGNED_REQUEST_HEADERS.nonce]: z.string().regex(/^[A-Za-z0-9_-]{16,64}$/, "must be a nonce"),
  [SIGNED_REQUEST_HEADERS.signature]: ed25519SignatureSchema,
})
export type SignedRequestHeaders = z.infer<typeof signedRequestHeadersSchema>

export const SIGNED_REQUEST_ERROR_CODES = [
  "signature.missing_header",
  "signature.malformed",
  "signature.stale",
  "signature.unknown_key",
  "signature.invalid",
  "signature.replayed",
] as const
export type SignedRequestErrorCode = (typeof SIGNED_REQUEST_ERROR_CODES)[number]
