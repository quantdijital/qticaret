import {
  asks,
  checkTravelers,
  cleanBirthDate,
  cleanCountry,
  cleanDocument,
  cleanName,
  levelOf,
  maskDocument,
  purgeAfterOf,
  travelersComplete,
} from "../travelers"
import type { TravelerNeed } from "../travelers"

const NOW = new Date("2026-11-22T10:00:00Z")

const person = (slotId: string, extra: Record<string, string> = {}) => ({
  slot_id: slotId,
  first_name: "  Ayşe  ",
  last_name: "Yılmaz",
  ...extra,
})

const refusal = (run: () => unknown) => {
  try {
    run()
  } catch (error) {
    return [(error as { safeMessage?: string }).safeMessage, (error as { field?: string }).field]
  }
  return null
}

describe("what a dated product asks of its travelers (adr/0076 §7)", () => {
  it("reads the level, anything unreadable asking nothing", () => {
    expect(levelOf({ level: "identity" })).toBe("identity")
    expect(levelOf(null)).toBe("none")
    expect(levelOf({ level: "passport" })).toBe("none")
  })

  it("adds the fields up level by level", () => {
    expect(asks("name", "birth_date")).toBe(false)
    expect(asks("birth_date", "birth_date")).toBe(true)
    expect(asks("birth_date", "document_no")).toBe(false)
    expect(asks("identity", "document_no")).toBe(true)
    expect(asks("identity", "nationality")).toBe(false)
    expect(asks("nationality", "birth_date")).toBe(true)
    expect(asks("none", "birth_date")).toBe(false)
  })
})

describe("a traveler's fields", () => {
  it("keeps a name trimmed, refuses an empty or control-character one", () => {
    expect(cleanName("  Ayşe   Nur ")).toBe("Ayşe Nur")
    expect(cleanName("   ")).toBeNull()
    expect(cleanName("Ali\u0000")).toBeNull()
    expect(cleanName("x".repeat(101))).toBeNull()
  })

  it("keeps a number upper-cased without spaces or dashes, 5 to 20 characters", () => {
    expect(cleanDocument("u 12-345 678")).toBe("U12345678")
    expect(cleanDocument("1234")).toBeNull()
    expect(cleanDocument("12345678901<")).toBeNull()
  })

  it("takes only a known two-letter country", () => {
    expect(cleanCountry("tr")).toBe("TR")
    expect(cleanCountry("DE")).toBe("DE")
    expect(cleanCountry("XX")).toBeNull()
    expect(cleanCountry("TUR")).toBeNull()
  })

  it("takes a real day, not in the future nor more than 120 years back", () => {
    expect(cleanBirthDate("1990-02-28", NOW)).toBe("1990-02-28")
    expect(cleanBirthDate("1990-02-30", NOW)).toBeNull()
    expect(cleanBirthDate("2027-01-01", NOW)).toBeNull()
    expect(cleanBirthDate("1900-01-01", NOW)).toBeNull()
    expect(cleanBirthDate("28.02.1990", NOW)).toBeNull()
  })

  it("shows a number by its last four only", () => {
    expect(maskDocument("5678")).toBe("***5678")
    expect(maskDocument(null)).toBeNull()
  })

  it("keeps a traveler 180 days after the departure's end, or its start", () => {
    const start = new Date("2026-12-01T09:00:00Z")
    const end = new Date("2026-12-03T18:00:00Z")
    expect(purgeAfterOf(start, end).toISOString()).toBe("2027-06-01T18:00:00.000Z")
    expect(purgeAfterOf(start, null).toISOString()).toBe("2027-05-30T09:00:00.000Z")
  })
})

describe("a cart's travelers checked against its departures", () => {
  const needs: TravelerNeed[] = [
    { slot_id: "bkslot_a", level: "identity", count: 2 },
    { slot_id: "bkslot_b", level: "none", count: 3 },
  ]
  const full = (extra: Record<string, string> = {}) =>
    person("bkslot_a", { birth_date: "1990-01-15", document_no: "u12345678", ...extra })

  it("takes exactly the places' worth, cleaned and in order", () => {
    const travelers = checkTravelers(needs, [full(), full({ document_no: "98765432101" })], NOW)

    expect(travelers).toEqual([
      expect.objectContaining({
        slot_id: "bkslot_a",
        position: 0,
        first_name: "Ayşe",
        document_no: "U12345678",
        nationality: null,
      }),
      expect.objectContaining({ position: 1, document_no: "98765432101" }),
    ])
  })

  it("refuses too few or too many travelers", () => {
    expect(refusal(() => checkTravelers(needs, [full()], NOW))).toEqual([
      "booking.travelers_invalid",
      "travelers",
    ])
    expect(refusal(() => checkTravelers(needs, [full(), full(), full()], NOW))).toEqual([
      "booking.travelers_invalid",
      "travelers",
    ])
  })

  it("refuses a field the level asks for and does not get", () => {
    expect(
      refusal(() =>
        checkTravelers(needs, [full(), person("bkslot_a", { birth_date: "1990-01-15" })], NOW)
      )
    ).toEqual(["booking.travelers_invalid", "travelers.1.document_no"])
  })

  it("refuses a field the product does not ask (no more than needed)", () => {
    expect(
      refusal(() => checkTravelers(needs, [full({ nationality: "TR" }), full()], NOW))
    ).toEqual(["booking.travelers_invalid", "travelers.0.nationality"])
  })

  it("refuses a traveler on a departure that asks none or is not in the cart", () => {
    expect(refusal(() => checkTravelers(needs, [person("bkslot_b")], NOW))).toEqual([
      "booking.travelers_invalid",
      "travelers.0.slot_id",
    ])
    expect(refusal(() => checkTravelers(needs, [person("bkslot_other")], NOW))).toEqual([
      "booking.travelers_invalid",
      "travelers.0.slot_id",
    ])
  })

  it("takes an empty list where no departure asks", () => {
    expect(checkTravelers([{ slot_id: "bkslot_b", level: "none", count: 2 }], [], NOW)).toEqual([])
  })
})

describe("whether the stored travelers still answer the cart", () => {
  const stored = (slotId: string, last4: string | null = "5678") => ({
    slot_id: slotId,
    birth_date: "1990-01-15",
    nationality: null,
    document_last4: last4,
  })

  it("is complete with as many as the places and the fields the level asks", () => {
    const needs: TravelerNeed[] = [{ slot_id: "bkslot_a", level: "identity", count: 2 }]
    expect(travelersComplete(needs, [stored("bkslot_a"), stored("bkslot_a")])).toBe(true)
  })

  it("is not once the places grew, or the product asks more now", () => {
    expect(
      travelersComplete(
        [{ slot_id: "bkslot_a", level: "identity", count: 3 }],
        [stored("bkslot_a"), stored("bkslot_a")]
      )
    ).toBe(false)
    expect(
      travelersComplete(
        [{ slot_id: "bkslot_a", level: "nationality", count: 1 }],
        [stored("bkslot_a")]
      )
    ).toBe(false)
    expect(
      travelersComplete(
        [{ slot_id: "bkslot_a", level: "identity", count: 1 }],
        [stored("bkslot_a", null)]
      )
    ).toBe(false)
  })

  it("asks nothing of a departure at none, or with no place taken", () => {
    expect(
      travelersComplete(
        [
          { slot_id: "bkslot_a", level: "none", count: 2 },
          { slot_id: "bkslot_b", level: "name", count: 0 },
        ],
        []
      )
    ).toBe(true)
  })
})
