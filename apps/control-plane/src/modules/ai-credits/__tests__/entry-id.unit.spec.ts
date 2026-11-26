import { ledgerEntryId } from "../entry-id"

describe("a ledger row's id", () => {
  it("looks like the module's other ids and sorts after the one before it, in the same millisecond too", () => {
    const at = Date.now() + 60_000
    const ids = [
      ledgerEntryId(at),
      ...Array.from({ length: 200 }, () => ledgerEntryId(at)),
      ledgerEntryId(at + 1),
      // A clock that stepped back still gives a later id
      ledgerEntryId(at - 5),
    ]
    for (const id of ids) {
      expect(id).toMatch(/^aient_[0-9A-HJKMNP-TV-Z]{26}$/)
    }
    expect(new Set(ids).size).toBe(ids.length)
    expect([...ids].sort()).toEqual(ids)
  })
})
