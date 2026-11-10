import { sign, verify, type KeyObject } from "node:crypto"
import { canonicalJsonDeep } from "../crypto/canonical-json"
import type { Ed25519Signer } from "./ed25519"

/**
 * Signed documents (adr/0061 §3.2): the control plane signs a shop's plan
 * document with its Ed25519 key; the shop checks it with the public keys it
 * holds (`CONTROL_PLANE_PUBLIC_KEYS`). The signature covers the document's
 * canonical JSON and its purpose, so a document of one kind never passes as
 * another. Freshness is the receiver's rule (`serial`), not the signature's.
 */

export const SIGNED_DOCUMENT_SCHEME = "QT-ED25519-DOC-V1"

const PURPOSE = /^[a-z][a-z0-9_.-]{0,63}$/
const SIGNATURE = /^[A-Za-z0-9_-]{86}$/
const KID = /^[A-Za-z0-9_-]{1,64}$/

export interface DocumentSignature {
  kid: string
  signature: string
}

export type DocumentVerifyErrorCode =
  "signature.malformed" | "signature.unknown_key" | "signature.invalid"

export function canonicalDocument(purpose: string, document: unknown): string {
  if (!PURPOSE.test(purpose)) {
    throw new TypeError("document purpose is malformed")
  }
  return `${SIGNED_DOCUMENT_SCHEME}\n${purpose}\n${canonicalJsonDeep(document)}`
}

export function signDocument(
  purpose: string,
  document: unknown,
  signer: Ed25519Signer
): DocumentSignature {
  const signature = sign(null, Buffer.from(canonicalDocument(purpose, document)), signer.privateKey)
  return { kid: signer.kid, signature: signature.toString("base64url") }
}

/** Never throws on input: a document that is not plain JSON is `signature.malformed`. */
export function verifyDocument(
  purpose: string,
  document: unknown,
  { kid, signature }: DocumentSignature,
  publicKey: (kid: string) => KeyObject | undefined
): { ok: true; kid: string } | { ok: false; code: DocumentVerifyErrorCode } {
  if (!KID.test(kid) || !SIGNATURE.test(signature)) {
    return { ok: false, code: "signature.malformed" }
  }
  const key = publicKey(kid)
  if (key === undefined) {
    return { ok: false, code: "signature.unknown_key" }
  }
  let message: string
  try {
    message = canonicalDocument(purpose, document)
  } catch {
    return { ok: false, code: "signature.malformed" }
  }
  try {
    if (verify(null, Buffer.from(message), key, Buffer.from(signature, "base64url"))) {
      return { ok: true, kid }
    }
  } catch {
    // A key of another type: the same answer as a wrong signature
  }
  return { ok: false, code: "signature.invalid" }
}
