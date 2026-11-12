import { randomBytes } from "node:crypto"
import { parseEnvelope, sealSecret } from "@qticaret/server-kit"
import { anyOf, fakeSecret } from "@qticaret/testing"
import { credentialKeyring } from "../../../lib/integrations/credential-keys"
import type { CredentialKeyring } from "../../../lib/integrations/credential-keys"
import { contextOf } from "../rows"
import {
  credentialContext,
  openCredentials,
  openSealedDraft,
  resealedForRestore,
  sealCredentials,
  upgradedSeal,
} from "../sealing"
import type { SealedRow } from "../sealing"
import { keyFingerprint } from "@qticaret/server-kit"

// Test-only keys and a made-up account, fresh per run
const [newKey, oldKey, otherKey] = [0, 1, 2].map(() => randomBytes(32).toString("hex"))
const settings = { merchant_id: "100001", test_mode: true }
const secrets = { merchant_key: fakeSecret(), merchant_salt: fakeSecret() }
const SECRETS = anyOf(secrets.merchant_key, secrets.merchant_salt)

const ring = (...keys: string[]): CredentialKeyring => {
  const keyring = credentialKeyring({ CREDENTIALS_ENCRYPTION_KEYS: keys.join(",") })
  if (!keyring) {
    throw new Error("no keyring")
  }
  return keyring
}

const rowOf = async (keyring: CredentialKeyring): Promise<SealedRow> => ({
  provider: "paytr",
  settings,
  ...(await sealCredentials(keyring, "paytr", settings, secrets)),
})

/** A row as adr/0027 sealed it: the box straight under the key. */
const legacyRow = (hex: string): SealedRow => {
  const key = Buffer.from(hex, "hex")
  return {
    provider: "paytr",
    settings,
    secret_ciphertext: sealSecret(JSON.stringify(secrets), key, contextOf("paytr", settings)),
    key_id: keyFingerprint(key),
  }
}

describe("sealed provider accounts (adr/0061 Ek C17)", () => {
  it("seals each account in its own envelope, naming the KEK, with no secret in sight", async () => {
    const keyring = ring(newKey ?? "")
    const [first, second] = [await rowOf(keyring), await rowOf(keyring)]

    expect(first.secret_ciphertext).toMatch(/^qtenv1\./)
    expect(first.key_id).toBe(keyring.wrapper.kekId)
    expect(parseEnvelope(first.secret_ciphertext).kekId).toBe(first.key_id)
    // A data key per record: the same account seals to unrelated blobs
    expect(parseEnvelope(first.secret_ciphertext).wrappedKey).not.toEqual(
      parseEnvelope(second.secret_ciphertext).wrappedKey
    )
    expect(JSON.stringify(first)).not.toMatch(SECRETS)
    expect(await openCredentials(keyring, first)).toEqual({ ok: true, secrets, stale: false })
  })

  it("opens nowhere else: another provider, changed settings, an edited KEK column", async () => {
    const keyring = ring(newKey ?? "")
    const row = await rowOf(keyring)
    const cases: SealedRow[] = [
      { ...row, provider: "iyzico" },
      { ...row, settings: { ...settings, test_mode: false } },
      { ...row, key_id: "0000000000000000" },
      { ...row, secret_ciphertext: `${row.secret_ciphertext.slice(0, -4)}AAAA` },
    ]

    for (const moved of cases) {
      const opened = await openCredentials(keyring, moved)
      expect(opened).toMatchObject({ ok: false, reason: "unreadable" })
      expect(JSON.stringify(opened)).not.toMatch(SECRETS)
    }
  })

  it("says a row's key is missing when its KEK is not configured", async () => {
    const row = await rowOf(ring(oldKey ?? ""))

    expect(await openCredentials(ring(newKey ?? ""), row)).toEqual({
      ok: false,
      reason: "kek_missing",
      key_id: row.key_id,
    })
    expect(await openCredentials(ring(newKey ?? ""), legacyRow(otherKey ?? ""))).toMatchObject({
      ok: false,
      reason: "kek_missing",
    })
  })

  it("reads an older KEK's row during a rotation and rewraps only its data key", async () => {
    const row = await rowOf(ring(oldKey ?? ""))
    const rotating = ring(newKey ?? "", oldKey ?? "")

    expect(await openCredentials(rotating, row)).toEqual({ ok: true, secrets, stale: true })
    const moved = { ...row, ...(await upgradedSeal(rotating, row, secrets)) }

    expect(moved.key_id).toBe(rotating.wrapper.kekId)
    // The data is not encrypted again: same ciphertext, a new wrapped key
    expect(parseEnvelope(moved.secret_ciphertext).ciphertext).toEqual(
      parseEnvelope(row.secret_ciphertext).ciphertext
    )
    // Once the old key is gone, the moved row still opens
    expect(await openCredentials(ring(newKey ?? ""), moved)).toEqual({
      ok: true,
      secrets,
      stale: false,
    })
  })

  it("reads an adr/0027 row and seals it again as an envelope", async () => {
    const keyring = ring(newKey ?? "", oldKey ?? "")
    const legacy = legacyRow(oldKey ?? "")

    expect(await openCredentials(keyring, legacy)).toEqual({ ok: true, secrets, stale: true })
    const upgraded = { ...legacy, ...(await upgradedSeal(keyring, legacy, secrets)) }

    expect(upgraded.secret_ciphertext).toMatch(/^qtenv1\./)
    expect(upgraded.key_id).toBe(keyring.wrapper.kekId)
    expect(await openCredentials(ring(newKey ?? ""), upgraded)).toMatchObject({ ok: true, secrets })
    // The old format still binds the provider and its settings
    expect(await openCredentials(keyring, { ...legacy, provider: "iyzico" })).toMatchObject({
      ok: false,
      reason: "unreadable",
    })
  })

  it("opens a draft sealed either way, under any configured key", async () => {
    const keyring = ring(newKey ?? "", oldKey ?? "")
    const envelope = await rowOf(ring(oldKey ?? ""))
    const legacy = legacyRow(oldKey ?? "")

    for (const text of [envelope.secret_ciphertext, legacy.secret_ciphertext]) {
      expect(await openSealedDraft(keyring, "paytr", settings, text)).toEqual(secrets)
      expect(await openSealedDraft(keyring, "iyzico", settings, text)).toBeNull()
      expect(await openSealedDraft(ring(otherKey ?? ""), "paytr", settings, text)).toBeNull()
    }
  })

  it("refuses to seal afresh a text that looks like an envelope but does not parse (review I1)", async () => {
    const keyring = ring(newKey ?? "", oldKey ?? "")
    const broken: SealedRow = {
      provider: "paytr",
      settings,
      secret_ciphertext: "qtenv1.not-a-kek.AAAA",
      key_id: "not-a-kek",
    }

    // The rewrap passes no secrets for envelopes: an empty account must never be sealed
    await expect(upgradedSeal(keyring, broken, {})).rejects.toMatchObject({
      code: "envelope.malformed",
    })
    expect(await resealedForRestore(keyring, broken)).toEqual({
      secret_ciphertext: broken.secret_ciphertext,
      key_id: broken.key_id,
    })
  })

  it("binds the settings in code-unit order, whatever the locale (review L4)", async () => {
    // "a" sorts before "B" in a locale's order, after it in code-unit order
    const mixed = { a: "1", B: "2", nested: { z: true, A: [1, { y: 1, X: 2 }] } }
    expect(credentialContext("paytr", mixed)["settings"]).toBe(
      '{"B":"2","a":"1","nested":{"A":[1,{"X":2,"y":1}],"z":true}}'
    )
    const keyring = ring(newKey ?? "")
    const row = {
      provider: "paytr",
      settings: mixed,
      ...(await sealCredentials(keyring, "paytr", mixed, secrets)),
    }

    // Another machine's collation: every comparison turned around
    const turned = jest.spyOn(String.prototype, "localeCompare").mockImplementation(function (
      this: string,
      other: string
    ) {
      return this < other ? 1 : this > other ? -1 : 0
    })
    try {
      expect(
        await openCredentials(keyring, {
          ...row,
          settings: { nested: mixed.nested, B: "2", a: "1" },
        })
      ).toEqual({
        ok: true,
        secrets,
        stale: false,
      })
    } finally {
      turned.mockRestore()
    }
  })

  it("puts a kept copy back under the current KEK (review I4)", async () => {
    const rotating = ring(newKey ?? "", oldKey ?? "")
    for (const kept of [await rowOf(ring(oldKey ?? "")), legacyRow(oldKey ?? "")]) {
      const restored = { ...kept, ...(await resealedForRestore(rotating, kept)) }

      expect(restored.key_id).toBe(rotating.wrapper.kekId)
      expect(await openCredentials(ring(newKey ?? ""), restored)).toMatchObject({
        ok: true,
        secrets,
      })
    }
    // Already current, or no key at all: as it was
    const current = await rowOf(rotating)
    expect(await resealedForRestore(rotating, current)).toEqual({
      secret_ciphertext: current.secret_ciphertext,
      key_id: current.key_id,
    })
    expect(await resealedForRestore(null, current)).toEqual({
      secret_ciphertext: current.secret_ciphertext,
      key_id: current.key_id,
    })
  })
})
