import { DURATION_KEYS, durationDaysOf } from "../duration"

/** adr/0077 Ek "tur kartı": a dated card's length, from the travel pack's "Süre" only. */
describe("durationDaysOf", () => {
  const sure = (value_number: unknown, definition: Record<string, unknown> = {}) => ({
    value_number,
    definition: { key: "sure", is_public: true, type: "number", ...definition },
  })

  it("reads the travel pack's length key", () => {
    expect(DURATION_KEYS).toEqual(["sure"])
    expect(durationDaysOf([sure(5)])).toBe(5)
    // Medusa may answer a number column as a string
    expect(durationDaysOf([null, sure("3")])).toBe(3)
  })

  it("says nothing without a public whole number from 1 to 365", () => {
    expect(durationDaysOf(undefined)).toBeNull()
    expect(durationDaysOf([])).toBeNull()
    expect(durationDaysOf([sure(null)])).toBeNull()
    expect(durationDaysOf([sure("")])).toBeNull()
    expect(durationDaysOf([sure(0)])).toBeNull()
    expect(durationDaysOf([sure(2.5)])).toBeNull()
    expect(durationDaysOf([sure(400)])).toBeNull()
    expect(durationDaysOf([sure("beş")])).toBeNull()
    // The shop's own note, or another type under the same key, is not shown
    expect(durationDaysOf([sure(5, { is_public: false })])).toBeNull()
    expect(durationDaysOf([sure(5, { type: "text" })])).toBeNull()
    // Another attribute's number is never read as a length
    expect(durationDaysOf([sure(5, { key: "kisi_sayisi" })])).toBeNull()
  })
})
