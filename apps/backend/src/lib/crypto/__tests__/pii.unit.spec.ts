import { randomBytes } from "node:crypto"
import { PiiKeyError, decryptPii, encryptPii, hashPii, parseKey } from "../pii"

const key = randomBytes(32)
const otherKey = randomBytes(32)
const CONTEXT = "billing_profile.tax_id"

describe("encryptPii / decryptPii", () => {
  it("round-trips and never contains the plaintext", () => {
    const payload = encryptPii("10000000146", key, CONTEXT)

    expect(payload).not.toContain("10000000146")
    expect(decryptPii(payload, key, CONTEXT)).toBe("10000000146")
  })

  it("uses a fresh IV, so equal values encrypt differently", () => {
    expect(encryptPii("10000000146", key, CONTEXT)).not.toBe(
      encryptPii("10000000146", key, CONTEXT)
    )
  })

  it.each([
    ["another key", (payload: string) => decryptPii(payload, otherKey, CONTEXT)],
    ["another context", (payload: string) => decryptPii(payload, key, "customer.phone")],
    [
      "a tampered ciphertext",
      (payload: string) => {
        const bytes = Buffer.from(payload, "base64")
        bytes[bytes.length - 1] = (bytes[bytes.length - 1] ?? 0) ^ 1
        return decryptPii(bytes.toString("base64"), key, CONTEXT)
      },
    ],
  ])("fails with %s", (_case, decrypt) => {
    expect(() => decrypt(encryptPii("10000000146", key, CONTEXT))).toThrow()
  })

  it("rejects a truncated payload", () => {
    expect(() => decryptPii("AAAA", key, CONTEXT)).toThrow(PiiKeyError)
  })
})

describe("hashPii", () => {
  it("is deterministic per key and context", () => {
    expect(hashPii("10000000146", key, CONTEXT)).toBe(hashPii("10000000146", key, CONTEXT))
    expect(hashPii("10000000146", key, CONTEXT)).not.toBe(hashPii("10000000146", otherKey, CONTEXT))
    expect(hashPii("10000000146", key, CONTEXT)).not.toBe(hashPii("10000000146", key, "other"))
  })
})

describe("parseKey", () => {
  it("accepts 64 hex characters", () => {
    expect(parseKey(key.toString("hex"), "PII_ENCRYPTION_KEY")).toEqual(key)
  })

  it("rejects other input without echoing it", () => {
    const secret = "not-a-key-value"
    expect(() => parseKey(secret, "PII_ENCRYPTION_KEY")).toThrow(
      "PII_ENCRYPTION_KEY must be 32 bytes as 64 hex characters"
    )
    try {
      parseKey(secret, "PII_ENCRYPTION_KEY")
    } catch (error) {
      expect(String(error)).not.toContain(secret)
    }
  })
})
