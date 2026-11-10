// Server code shared by the shop backend and the control plane (adr/0061 §1.2).
// Nothing here knows Medusa or a shop: Medusa-specific code stays in the apps.

export { PiiKeyError, decryptPii, encryptPii, hashPii, parseKey } from "./crypto/pii"
export { keyFingerprint, openSecret, sealSecret } from "./crypto/secrets"
export { CanonicalJsonError, canonicalJson, canonicalJsonDeep } from "./crypto/canonical-json"
export {
  EnvelopeError,
  KEK_ID_PATTERN,
  createLocalKeyWrapper,
  kekFingerprint,
  parseKekList,
} from "./crypto/key-wrapper"
export type { EnvelopeErrorCode, KeyWrapper, WrappedKey } from "./crypto/key-wrapper"
export {
  ENVELOPE_VERSION,
  needsRewrap,
  openEnvelope,
  openEnvelopeText,
  parseEnvelope,
  rewrapEnvelope,
  sealEnvelope,
  serializeEnvelope,
} from "./crypto/envelope"
export type { Envelope, EnvelopeContext } from "./crypto/envelope"

export { newWebhookSecret, signBody, signatureHeader } from "./signing/webhook"
export {
  SigningKeyError,
  ed25519KeyId,
  generateEd25519KeyPair,
  parsePublicKeys,
  parseSigningKey,
  privateKeyFromSeed,
  privateKeySeed,
  publicKeyFromRaw,
  rawPublicKey,
  signerFromPrivateKey,
} from "./signing/ed25519"
export type { Ed25519Signer } from "./signing/ed25519"
export { MemoryNonceStore } from "./signing/nonce-store"
export type { NonceStore } from "./signing/nonce-store"
export {
  DEFAULT_MAX_SKEW_SECONDS,
  DEFAULT_NONCE_TTL_SECONDS,
  SIGNED_REQUEST_HEADERS,
  SIGNED_REQUEST_SCHEME,
  bodyDigest,
  canonicalRequest,
  signRequest,
  verifySignedRequest,
} from "./signing/request"
export type {
  IncomingSignedRequest,
  RequestParts,
  SignRequestInput,
  SignedRequestErrorCode,
  VerifiedRequest,
  VerifyRequestOptions,
} from "./signing/request"
export {
  SIGNED_DOCUMENT_SCHEME,
  canonicalDocument,
  signDocument,
  verifyDocument,
} from "./signing/document"
export type { DocumentSignature, DocumentVerifyErrorCode } from "./signing/document"

export { safeEqual } from "./security/timing-safe"
export { REDACTED, isSensitiveKey, redactDeep, redactText } from "./logging/redact"
export { TAX_ID_KINDS, detectTaxIdKind, isValidTckn, isValidVkn, maskTaxId } from "./tr/tax-id"
export type { TaxIdKind } from "./tr/tax-id"
export {
  EnvValidationError,
  NODE_ENVS,
  SECRET_MIN_LENGTH,
  isBareOrigin,
  isHttpOrigin,
  isLocalEnv,
  isLoopbackUrl,
  key256,
  nodeEnv,
  originList,
  parseEnvWith,
  secret,
} from "./env"
