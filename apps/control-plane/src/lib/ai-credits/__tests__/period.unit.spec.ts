import { addMonths, istanbulMonth, nextMonthStart, splitCharge, spentOn } from "../period"

describe("AI credits' calendar (adr/0085 K5, K6, K7)", () => {
  it("reads the month in Istanbul: 21:00 UTC on the last day is already the next month", () => {
    expect(istanbulMonth(new Date("2026-11-30T20:59:59.999Z"))).toBe("2026-11")
    expect(istanbulMonth(new Date("2026-11-30T21:00:00.000Z"))).toBe("2026-12")
    expect(istanbulMonth(new Date("2026-12-31T21:00:00.000Z"))).toBe("2027-01")
  })

  it("renews on the first day of the next month, over a year's end", () => {
    expect(nextMonthStart("2026-11")).toBe("2026-12-01")
    expect(nextMonthStart("2026-12")).toBe("2027-01-01")
    expect(nextMonthStart("2027-01")).toBe("2027-02-01")
    expect(() => nextMonthStart("2026-1")).toThrow("not a month")
  })

  it("adds calendar months, a day past a shorter month's end clamped to its last", () => {
    expect(addMonths(new Date("2026-11-25T10:00:00.000Z"), 12).toISOString()).toBe(
      "2027-11-25T10:00:00.000Z"
    )
    expect(addMonths(new Date("2026-01-31T10:00:00.000Z"), 1).toISOString()).toBe(
      "2026-02-28T10:00:00.000Z"
    )
    expect(addMonths(new Date("2028-02-29T00:00:00.000Z"), 12).toISOString()).toBe(
      "2029-02-28T00:00:00.000Z"
    )
  })

  it("takes the month's grant first, then the bought credits", () => {
    expect(splitCharge(10, 3)).toEqual({ plan: 3, purchased: 0 })
    expect(splitCharge(3, 3)).toEqual({ plan: 3, purchased: 0 })
    expect(splitCharge(1, 3)).toEqual({ plan: 1, purchased: 2 })
    expect(splitCharge(0, 40)).toEqual({ plan: 0, purchased: 40 })
    expect(splitCharge(-1, 2)).toEqual({ plan: 0, purchased: 2 })
  })

  it("counts the day's spend only on its own day", () => {
    expect(spentOn(12, "2026-11-25", "2026-11-25")).toBe(12)
    expect(spentOn(12, "2026-11-24", "2026-11-25")).toBe(0)
    expect(spentOn(0, null, "2026-11-25")).toBe(0)
  })
})
