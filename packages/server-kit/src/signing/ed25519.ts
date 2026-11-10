import {
  createHash,
  createPrivateKey,
  createPublicKey,
  generateKeyPairSync,
  type KeyObject,
} from "node:crypto"

/**
 * Ed25519 keys for messages between the control plane and a shop
 * (adr/0061 §3.2). Keys travel as their raw 32 bytes in base64url (the
 * private key as its seed), so an env value is one short line; the key id
 * (`kid`) is derived from the public key, so it cannot be mislabelled.
 */

// DER headers of the PKCS#8 and SPKI forms of an Ed25519 key (RFC 8410),
// followed by the 32 raw bytes
const PKCS8_PREFIX = Buffer.from("302e020100300506032b657004220420", "hex")
const SPKI_PREFIX = Buffer.from("302a300506032b6570032100", "hex")
const RAW_BYTES = 32
const BASE64URL_32 = /^[A-Za-z0-9_-]{43}$/

export class SigningKeyError extends Error {
  override readonly name = "SigningKeyError"
  readonly code = "signing.invalid_key"
}

export interface Ed25519Signer {
  readonly kid: string
  readonly privateKey: KeyObject
}

export function privateKeyFromSeed(seed: Buffer): KeyObject {
  if (seed.length !== RAW_BYTES) {
    throw new SigningKeyError("an Ed25519 private key must be 32 bytes")
  }
  return createPrivateKey({
    key: Buffer.concat([PKCS8_PREFIX, seed]),
    format: "der",
    type: "pkcs8",
  })
}

export function publicKeyFromRaw(raw: Buffer): KeyObject {
  if (raw.length !== RAW_BYTES) {
    throw new SigningKeyError("an Ed25519 public key must be 32 bytes")
  }
  return createPublicKey({ key: Buffer.concat([SPKI_PREFIX, raw]), format: "der", type: "spki" })
}

const assertEd25519 = (key: KeyObject): void => {
  if (key.asymmetricKeyType !== "ed25519") {
    throw new SigningKeyError("not an Ed25519 key")
  }
}

/** The public key's raw 32 bytes; from a private key, its public half. */
export function rawPublicKey(key: KeyObject): Buffer {
  assertEd25519(key)
  const publicKey = key.type === "private" ? createPublicKey(key) : key
  return publicKey.export({ format: "der", type: "spki" }).subarray(SPKI_PREFIX.length)
}

/** The private key's 32-byte seed, the form `TENANT_SIGNING_KEY` keeps. */
export function privateKeySeed(key: KeyObject): Buffer {
  assertEd25519(key)
  if (key.type !== "private") {
    throw new SigningKeyError("not a private key")
  }
  return key.export({ format: "der", type: "pkcs8" }).subarray(PKCS8_PREFIX.length)
}

/** 16 hex characters of a domain-separated hash of the public key. */
export function ed25519KeyId(key: KeyObject): string {
  return createHash("sha256")
    .update("qt:ed25519:kid|")
    .update(rawPublicKey(key))
    .digest("hex")
    .slice(0, 16)
}

export function signerFromPrivateKey(privateKey: KeyObject): Ed25519Signer {
  return { kid: ed25519KeyId(privateKey), privateKey }
}

/** A new key pair as env values: the seed (secret) and the public key, base64url. */
export function generateEd25519KeyPair(): { kid: string; seed: string; publicKey: string } {
  const { privateKey } = generateKeyPairSync("ed25519")
  return {
    kid: ed25519KeyId(privateKey),
    seed: privateKeySeed(privateKey).toString("base64url"),
    publicKey: rawPublicKey(privateKey).toString("base64url"),
  }
}

const decode32 = (value: string, name: string): Buffer => {
  if (!BASE64URL_32.test(value)) {
    // The variable's name only: the value may be a private key
    throw new SigningKeyError(`${name} must be a 32-byte key in base64url`)
  }
  return Buffer.from(value, "base64url")
}

/** `TENANT_SIGNING_KEY`, `CP_SIGNING_KEY`: the seed in base64url. */
export function parseSigningKey(value: string, name: string): Ed25519Signer {
  return signerFromPrivateKey(privateKeyFromSeed(decode32(value.trim(), name)))
}

/**
 * `CONTROL_PLANE_PUBLIC_KEYS`: comma-separated public keys in base64url, by
 * key id. Several are listed while a key is rotated (adr/0061 §4.5).
 */
export function parsePublicKeys(value: string, name: string): Map<string, KeyObject> {
  const keys = new Map<string, KeyObject>()
  for (const part of value.split(",").map((item) => item.trim())) {
    if (part === "") {
      continue
    }
    const key = publicKeyFromRaw(decode32(part, name))
    keys.set(ed25519KeyId(key), key)
  }
  if (keys.size === 0) {
    throw new SigningKeyError(`${name} must list at least one key`)
  }
  return keys
}
