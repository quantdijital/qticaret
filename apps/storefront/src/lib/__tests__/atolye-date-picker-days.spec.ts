import { describe, expect, it } from "vitest"
import {
  addDays,
  canPick,
  dayPlace,
  daysIn,
  monthWeeks,
  movedDay,
  pickDay,
  toggleMonth,
} from "../../../../../packages/themes/atolye/src/parts/date-picker-days"

/**
 * The search calendar's arithmetic (adr/0077 §6, PR6): a month Monday
 * first, a range of at most 62 days from today on, at most three flexible
 * months, the arrows held within the months a search reads.
 */

const bounds = { min: "2026-11-24", max: "2027-10-31", maxDays: 62 }

describe("the calendar's month", () => {
  it("lays a month out in weeks, Monday first", () => {
    // 1 December 2026 is a Tuesday, the 31st a Thursday
    const weeks = monthWeeks("2026-12")
    expect(weeks).toHaveLength(5)
    expect(weeks[0]).toEqual([null, ...Array.from({ length: 6 }, (_, i) => `2026-12-0${i + 1}`)])
    expect(weeks[4]).toEqual([
      "2026-12-28",
      "2026-12-29",
      "2026-12-30",
      "2026-12-31",
      null,
      null,
      null,
    ])
    expect(monthWeeks("2027-02").flat().filter(Boolean)).toHaveLength(28)
  })

  it("counts days across months and years", () => {
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01")
    expect(daysIn("2026-12-01", "2027-01-31")).toBe(62)
  })
})

describe("a range picked", () => {
  it("starts on the first day, ends on the second, starts again after", () => {
    const started = pickDay({ from: "", to: "" }, "2026-12-05", bounds)
    expect(started).toEqual({ from: "2026-12-05", to: "" })
    const ended = pickDay(started, "2026-12-10", bounds)
    expect(ended).toEqual({ from: "2026-12-05", to: "2026-12-10" })
    expect(pickDay(ended, "2026-12-20", bounds)).toEqual({ from: "2026-12-20", to: "" })
    expect(dayPlace(ended, "2026-12-07")).toBe("inside")
    expect(dayPlace(ended, "2026-12-10")).toBe("end")
  })

  it("starts again on a day before the start; the start pressed twice is that one day", () => {
    const started = { from: "2026-12-05", to: "" }
    expect(pickDay(started, "2026-12-01", bounds)).toEqual({ from: "2026-12-01", to: "" })
    expect(pickDay(started, "2026-12-05", bounds)).toEqual({ from: "2026-12-05", to: "2026-12-05" })
  })

  it("ends a range at 62 days at most, both ends counted", () => {
    const started = { from: "2026-12-01", to: "" }
    expect(canPick(started, "2027-01-31", bounds)).toBe(true)
    expect(canPick(started, "2027-02-01", bounds)).toBe(false)
    expect(pickDay(started, "2027-02-01", bounds)).toBe(started)
  })

  it("takes no day before today nor after the last month", () => {
    const none = { from: "", to: "" }
    expect(canPick(none, "2026-11-23", bounds)).toBe(false)
    expect(canPick(none, "2026-11-24", bounds)).toBe(true)
    expect(canPick(none, "2027-11-01", bounds)).toBe(false)
    expect(pickDay(none, "2026-11-23", bounds)).toBe(none)
  })
})

describe("flexible months", () => {
  it("takes three at most, in order, and lets one go", () => {
    let months: string[] = []
    for (const month of ["2027-01", "2026-12", "2027-03"]) {
      const next = toggleMonth(months, month, 3)
      expect(next.full).toBe(false)
      months = next.months
    }
    expect(months).toEqual(["2026-12", "2027-01", "2027-03"])
    expect(toggleMonth(months, "2027-04", 3)).toEqual({ months, full: true })
    expect(toggleMonth(months, "2027-01", 3).months).toEqual(["2026-12", "2027-03"])
  })
})

describe("the keys in the month", () => {
  it("move a day, a week, a month, held within the bounds", () => {
    expect(movedDay("2026-12-31", "ArrowRight", bounds)).toBe("2027-01-01")
    expect(movedDay("2026-12-10", "ArrowUp", bounds)).toBe("2026-12-03")
    expect(movedDay("2026-11-26", "ArrowUp", bounds)).toBe("2026-11-24")
    expect(movedDay("2027-01-31", "PageDown", bounds)).toBe("2027-02-28")
    expect(movedDay("2027-10-30", "ArrowDown", bounds)).toBe("2027-10-31")
    expect(movedDay("2026-12-10", "Tab", bounds)).toBeNull()
  })
})
