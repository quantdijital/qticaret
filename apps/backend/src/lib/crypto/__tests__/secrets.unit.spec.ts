import { randomBytes } from "node:crypto"
import { keyFingerprint, openSecret, sealSecret } from "../secrets"

describe("provider secrets", () => {
  const key = randomBytes(32)

  it("opens only with the same key and provider", () => {
    const sealed = sealSecret('{"merchant_key":"k"}', key, "integration_credentials:paytr")

    expect(openSecret(sealed, key, "integration_credentials:paytr")).toBe('{"merchant_key":"k"}')
    expect(() => openSecret(sealed, key, "integration_credentials:iyzico")).toThrow()
    expect(() => openSecret(sealed, randomBytes(32), "integration_credentials:paytr")).toThrow()
  })

  it("names a key by a stable fingerprint that tells keys apart", () => {
    expect(keyFingerprint(key)).toMatch(/^[0-9a-f]{16}$/)
    expect(keyFingerprint(Buffer.from(key))).toBe(keyFingerprint(key))
    expect(keyFingerprint(randomBytes(32))).not.toBe(keyFingerprint(key))
  })
})
