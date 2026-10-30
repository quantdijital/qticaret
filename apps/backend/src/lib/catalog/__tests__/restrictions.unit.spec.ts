import { ADULT_CONSIDERATIONS, ageOn, restrictionOf } from "../restrictions"
import type { Restriction } from "../restrictions"

describe("restricted products (F13.4)", () => {
  const marked = new Map<string, Restriction>([["pcat_mutfak", "weapon"]])

  it("takes the product's own mark first, else a marked category it is in or under", () => {
    // Under the marked category: its mark reaches the child and its products
    const inChild = [{ id: "pcat_bicak", mpath: "pcat_mutfak.pcat_bicak" }]

    expect(restrictionOf("alcohol", inChild, marked)).toBe("alcohol")
    expect(restrictionOf(null, inChild, marked)).toBe("weapon")
    expect(restrictionOf(null, [{ id: "pcat_bahce", mpath: "pcat_bahce" }], marked)).toBeNull()
    expect(restrictionOf("uydurma", null, marked)).toBeNull()
    expect(ADULT_CONSIDERATIONS.weapon).toBe("https://schema.org/WeaponConsideration")
  })
})

describe("a declared age (F13.3)", () => {
  // Still 30 October in UTC, already the 31st in Türkiye (00:30)
  const now = new Date("2026-10-30T21:30:00.000Z")

  it("counts whole years in Türkiye's time, a birthday from its first moment there", () => {
    expect(ageOn("2008-10-31", now)).toBe(18)
    expect(ageOn("2008-11-01", now)).toBe(17)
    expect(ageOn("1990-05-01", now)).toBe(36)
  })

  it("refuses a date that is not one, or one still to come", () => {
    expect(ageOn("2000-02-30", now)).toBeNull()
    expect(ageOn("01.05.1990", now)).toBeNull()
    expect(ageOn("2030-01-01", now)).toBeNull()
  })
})
