import { randomBytes } from "node:crypto"
import { kekFingerprint, keyFingerprint } from "@qticaret/server-kit"
import {
  configuredCredentialKeys,
  credentialKeyring,
  credentialKeysProblem,
} from "../credential-keys"

// Test-only keys, fresh per run
const hexKey = () => randomBytes(32).toString("hex")

describe("credential keys (adr/0061 Ek C17)", () => {
  it("takes the list newest first, or the single key alone", () => {
    const [newKey, oldKey, single] = [hexKey(), hexKey(), hexKey()]

    expect(
      configuredCredentialKeys({
        CREDENTIALS_ENCRYPTION_KEYS: ` ${newKey} ,${oldKey.toUpperCase()}`,
      })
    ).toEqual([newKey, oldKey])
    expect(configuredCredentialKeys({ CREDENTIALS_ENCRYPTION_KEY: single })).toEqual([single])
    // The list wins; the boot's schema has made sure the single key is in it
    expect(
      configuredCredentialKeys({
        CREDENTIALS_ENCRYPTION_KEYS: newKey,
        CREDENTIALS_ENCRYPTION_KEY: single,
      })
    ).toEqual([newKey])
    expect(configuredCredentialKeys({})).toEqual([])
    expect(configuredCredentialKeys({ CREDENTIALS_ENCRYPTION_KEY: "" })).toEqual([])
  })

  it("builds one keyring: the first key wraps, each key's old-format fingerprint maps to it", () => {
    const [newKey, oldKey] = [hexKey(), hexKey()]
    const keyring = credentialKeyring({ CREDENTIALS_ENCRYPTION_KEYS: `${newKey},${oldKey}` })
    const ids = [newKey, oldKey].map((hex) => kekFingerprint(Buffer.from(hex, "hex")))

    expect(keyring?.wrapper.kekId).toBe(ids[0])
    expect(keyring?.kekIds).toEqual(ids)
    expect(keyring?.wrapper.canUnwrap(ids[1] ?? "")).toBe(true)
    expect(keyring?.legacy.get(keyFingerprint(Buffer.from(oldKey, "hex")))?.kekId).toBe(ids[1])
    // The legacy fingerprint is domain-separated from the KEK id
    expect(keyring?.legacy.has(ids[1] ?? "")).toBe(false)
  })

  it("is rebuilt only when the values change, and is null without a key", () => {
    const env = { CREDENTIALS_ENCRYPTION_KEY: hexKey() }
    const first = credentialKeyring(env)

    expect(credentialKeyring({ ...env })).toBe(first)
    expect(credentialKeyring({ CREDENTIALS_ENCRYPTION_KEYS: hexKey() })).not.toBe(first)
    expect(credentialKeyring({})).toBeNull()
  })

  it("refuses a malformed list by name, never echoing a value", () => {
    const key = hexKey()
    const values = [`${key},`, `${key},${key}`, `${key},nothex`, `kid:${key}`]

    for (const value of values) {
      expect(credentialKeysProblem(value)).not.toBeNull()
      expect(() => credentialKeyring({ CREDENTIALS_ENCRYPTION_KEYS: value })).toThrow(
        /^CREDENTIALS_ENCRYPTION_KEYS must/
      )
      try {
        credentialKeyring({ CREDENTIALS_ENCRYPTION_KEYS: value })
      } catch (error) {
        expect(String(error)).not.toContain(key)
      }
    }
    expect(credentialKeysProblem(key)).toBeNull()
  })
})
