import { randomBytes } from "node:crypto"
import { decryptPii } from "@qticaret/server-kit"
import { replaceCartTravelers, revealDocument, sealTraveler } from "../travelers"
import type { Executor } from "../sql"

const keys = { encryption: randomBytes(32), hash: randomBytes(32) }
const PURGE = new Date("2027-06-01T00:00:00Z")
const traveler = {
  slot_id: "bkslot_a",
  position: 0,
  first_name: "Ayşe",
  last_name: "Yılmaz",
  birth_date: "1990-01-15",
  document_no: "U12345678",
  nationality: "TR",
}

/** An executor that records each statement and answers `rows` to a SELECT. */
function recorder(rows: Record<string, unknown>[] = []) {
  const calls: { sql: string; params: unknown[] }[] = []
  const manager: Executor = {
    execute: (sql, params) => {
      calls.push({ sql, params })
      return Promise.resolve(sql.trim().startsWith("SELECT") ? rows : [])
    },
  }
  return { manager, calls }
}

describe("a traveler's ID number sealed (adr/0076 §7, adr/0009)", () => {
  it("keeps it only encrypted, hashed and as its last four", () => {
    const sealed = sealTraveler(keys, "cart_1", traveler, PURGE)

    expect(sealed).toMatchObject({
      first_name: "Ayşe",
      nationality: "TR",
      document_last4: "5678",
      key_version: 1,
      purge_after: PURGE,
    })
    expect(JSON.stringify(sealed)).not.toContain("U12345678")
    expect(sealed.document_hash).toMatch(/^[0-9a-f]+$/)
    expect(
      decryptPii(
        sealed.document_encrypted ?? "",
        keys.encryption,
        "booking_traveler.document:cart_1"
      )
    ).toBe("U12345678")
  })

  it("hashes the same number the same way, whichever cart", () => {
    const one = sealTraveler(keys, "cart_1", traveler, PURGE)
    const two = sealTraveler(keys, "cart_2", traveler, PURGE)
    expect(one.document_hash).toBe(two.document_hash)
    expect(one.document_encrypted).not.toBe(two.document_encrypted)
  })

  it("keeps nothing of a number not asked", () => {
    expect(sealTraveler(keys, "cart_1", { ...traveler, document_no: null }, PURGE)).toMatchObject({
      document_encrypted: null,
      document_hash: null,
      document_last4: null,
      key_version: null,
    })
  })

  it("writes no plain number to the database", async () => {
    const { manager, calls } = recorder()
    await replaceCartTravelers(manager, "cart_1", [sealTraveler(keys, "cart_1", traveler, PURGE)])

    expect(calls[0]?.sql).toMatch(
      /DELETE FROM booking_traveler WHERE cart_id = \? AND booking_id IS NULL/
    )
    expect(calls[1]?.sql).toMatch(/INSERT INTO booking_traveler/)
    expect(JSON.stringify(calls.map((call) => call.params))).not.toContain("U12345678")
  })

  it("reads the number back only for its own cart", async () => {
    const sealed = sealTraveler(keys, "cart_1", traveler, PURGE)
    const own = recorder([
      { cart_id: "cart_1", document_encrypted: sealed.document_encrypted, key_version: 1 },
    ])
    const moved = recorder([
      { cart_id: "cart_2", document_encrypted: sealed.document_encrypted, key_version: 1 },
    ])

    expect(await revealDocument(own.manager, keys, "bktrv_1")).toBe("U12345678")
    expect(own.calls[0]?.sql).toMatch(/booking_id IS NOT NULL/)
    // A ciphertext copied onto another cart's row fails, never shows the wrong person's
    await expect(revealDocument(moved.manager, keys, "bktrv_1")).rejects.toThrow()
  })

  it("answers an unknown or unbooked traveler as missing", async () => {
    await expect(revealDocument(recorder([]).manager, keys, "bktrv_x")).rejects.toMatchObject({
      message: "booking.traveler_unknown",
    })
  })
})
