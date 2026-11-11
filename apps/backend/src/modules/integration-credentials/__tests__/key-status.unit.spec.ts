import { randomBytes } from "node:crypto"
import { keyFingerprint } from "@qticaret/server-kit"
import { credentialKeyring } from "../../../lib/integrations/credential-keys"
import { statusLines } from "../../../scripts/credentials-keys"
import { keyStatusOf } from "../key-status"

// Test-only keys, fresh per run
const [newKey, oldKey] = [0, 1].map(() => randomBytes(32).toString("hex"))
const keyring = credentialKeyring({
  CREDENTIALS_ENCRYPTION_KEYS: `${newKey ?? ""},${oldKey ?? ""}`,
})
const [currentId, olderId] = keyring?.kekIds ?? []
const oldLegacyId = keyFingerprint(Buffer.from(oldKey ?? "", "hex"))

describe("credential key status (adr/0061 Ek C17)", () => {
  it("counts each key's accounts by state and says what is left to move", () => {
    const status = keyStatusOf(keyring, [
      { key_id: currentId ?? "", envelope: true, records: 3 },
      { key_id: olderId ?? "", envelope: true, records: 1 },
      { key_id: oldLegacyId, envelope: false, records: 2 },
      { key_id: "feedfacefeedface", envelope: true, records: 1 },
    ])

    expect(status.keys).toEqual([
      { kek_id: currentId, state: "current", records: 3 },
      { kek_id: olderId, state: "older", records: 1 },
      { kek_id: olderId, state: "legacy", records: 2 },
      { kek_id: "feedfacefeedface", state: "missing", records: 1 },
    ])
    expect(status).toMatchObject({ pending: 3, stranded: 1, removable: [] })
  })

  it("lets the old key go once nothing is under it", () => {
    const status = keyStatusOf(keyring, [{ key_id: currentId ?? "", envelope: true, records: 4 }])

    expect(status).toMatchObject({ pending: 0, stranded: 0, removable: [olderId] })
    const lines = statusLines(status).join("\n")
    expect(lines).toContain(`${String(olderId)} holds nothing: it may be removed`)
    // Fingerprints and counts only
    expect(lines).not.toContain(newKey)
    expect(lines).not.toContain(oldKey)
  })

  it("says when no key is configured", () => {
    const status = keyStatusOf(null, [{ key_id: oldLegacyId, envelope: false, records: 1 }])

    expect(status).toMatchObject({ configured: false, stranded: 1 })
    expect(statusLines(status)).toEqual([
      expect.stringContaining("no key is configured") as unknown,
    ])
  })
})
