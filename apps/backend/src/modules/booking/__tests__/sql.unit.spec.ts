import { marks, normalizeUnits, unitsBySlot } from "../sql"

const keyOf = (run: () => unknown): string | undefined => {
  try {
    run()
    return undefined
  } catch (error) {
    return (error as { safeMessage?: string }).safeMessage
  }
}

describe("booking SQL helpers", () => {
  it("adds up a slot named twice and sorts the slots by id, the lock order", () => {
    expect(
      normalizeUnits(
        [
          { slotId: "bkslot_b", units: 2 },
          { slotId: "bkslot_a", units: 1 },
          { slotId: "bkslot_b", units: 1 },
        ],
        1
      )
    ).toEqual([
      { slotId: "bkslot_a", units: 1 },
      { slotId: "bkslot_b", units: 3 },
    ])
  })

  it("refuses units that are not whole, too many, or zero where zero is not allowed", () => {
    expect(keyOf(() => normalizeUnits([{ slotId: "bkslot_a", units: 1.5 }], 1))).toBe(
      "booking.units_invalid"
    )
    expect(keyOf(() => normalizeUnits([{ slotId: "bkslot_a", units: 0 }], 1))).toBe(
      "booking.units_invalid"
    )
    expect(keyOf(() => normalizeUnits([{ slotId: "bkslot_a", units: 10_001 }], 0))).toBe(
      "booking.units_invalid"
    )
    expect(keyOf(() => normalizeUnits([], 0))).toBe("booking.units_invalid")
    expect(keyOf(() => normalizeUnits([{ slotId: "", units: 1 }], 0))).toBe("booking.slot_unknown")
    expect(normalizeUnits([{ slotId: "bkslot_a", units: 0 }], 0)).toEqual([
      { slotId: "bkslot_a", units: 0 },
    ])
  })

  it("sums returned rows per slot and binds lists value by value", () => {
    expect(
      unitsBySlot([
        { slot_id: "bkslot_b", units: "2" },
        { slot_id: "bkslot_a", units: 1 },
        { slot_id: "bkslot_b", units: 3 },
      ])
    ).toEqual([
      { slotId: "bkslot_a", units: 1 },
      { slotId: "bkslot_b", units: 5 },
    ])
    expect(marks(3)).toBe("?, ?, ?")
  })
})
