import { generateKeyPairSync, sign, verify } from "node:crypto"
import {
  SigningKeyError,
  ed25519KeyId,
  generateEd25519KeyPair,
  parsePublicKeys,
  parseSigningKey,
  privateKeySeed,
  rawPublicKey,
} from "../ed25519"

describe("Ed25519 keys as env values", () => {
  it("round-trips a generated pair and derives the same kid on both sides", () => {
    const pair = generateEd25519KeyPair()
    const signer = parseSigningKey(pair.seed, "TENANT_SIGNING_KEY")
    const publicKeys = parsePublicKeys(pair.publicKey, "CONTROL_PLANE_PUBLIC_KEYS")

    expect(signer.kid).toBe(pair.kid)
    expect([...publicKeys.keys()]).toEqual([pair.kid])
    const message = Buffer.from("hello")
    const publicKey = publicKeys.get(pair.kid)
    expect(publicKey).toBeDefined()
    if (publicKey) {
      expect(verify(null, message, publicKey, sign(null, message, signer.privateKey))).toBe(true)
    }
  })

  it("keeps the raw forms of a Node key", () => {
    const { privateKey, publicKey } = generateKeyPairSync("ed25519")

    expect(rawPublicKey(privateKey)).toEqual(rawPublicKey(publicKey))
    expect(privateKeySeed(privateKey)).toHaveLength(32)
    expect(ed25519KeyId(privateKey)).toMatch(/^[0-9a-f]{16}$/)
    expect(ed25519KeyId(privateKey)).toBe(ed25519KeyId(publicKey))
  })

  it("lists several public keys while a key is rotated", () => {
    const one = generateEd25519KeyPair()
    const two = generateEd25519KeyPair()

    const keys = parsePublicKeys(` ${one.publicKey}, ${two.publicKey} ,`, "KEYS")
    expect([...keys.keys()]).toEqual([one.kid, two.kid])
  })

  it("refuses malformed values without echoing them", () => {
    const value = "not-a-private-key"

    expect(() => parseSigningKey(value, "TENANT_SIGNING_KEY")).toThrow(
      "TENANT_SIGNING_KEY must be a 32-byte key in base64url"
    )
    try {
      parseSigningKey(value, "TENANT_SIGNING_KEY")
    } catch (error) {
      expect(error).toBeInstanceOf(SigningKeyError)
      expect(String(error)).not.toContain(value)
    }
    expect(() => parsePublicKeys(",", "KEYS")).toThrow("KEYS must list at least one key")
  })

  it("refuses a key of another type", () => {
    const { privateKey } = generateKeyPairSync("x25519")

    expect(() => rawPublicKey(privateKey)).toThrow(SigningKeyError)
  })
})
