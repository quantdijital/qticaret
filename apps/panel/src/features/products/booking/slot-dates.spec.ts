import { describe, expect, it } from "vitest"
import { localOf, recurringStarts, zonedIso } from "./slot-dates"

describe("zonedIso", () => {
  it("reads the wall clock in the product's zone, whatever the browser's", () => {
    expect(zonedIso("2027-05-01T09:00")).toBe("2027-05-01T09:00:00+03:00")
    expect(zonedIso("2027-01-15T09:00", "Europe/Berlin")).toBe("2027-01-15T09:00:00+01:00")
    expect(zonedIso("2027-07-15T09:00", "Europe/Berlin")).toBe("2027-07-15T09:00:00+02:00")
  })

  it("refuses what is not a time", () => {
    expect(zonedIso("")).toBeNull()
    expect(zonedIso("2027-02-30T09:00")).toBeNull()
    expect(zonedIso("2027-05-01")).toBeNull()
  })

  it("gives back the wall clock for a field", () => {
    expect(localOf("2027-05-01T06:00:00.000Z")).toBe("2027-05-01T09:00")
  })
})

describe("recurringStarts", () => {
  const now = new Date("2027-04-01T00:00:00Z")

  it("makes every Saturday at 09:00 in the range, both ends taken", () => {
    const { starts, more } = recurringStarts({
      from: "2027-05-01",
      to: "2027-05-29",
      weekdays: [6],
      time: "09:00",
      now,
    })
    expect(starts).toEqual([
      "2027-05-01T09:00:00+03:00",
      "2027-05-08T09:00:00+03:00",
      "2027-05-15T09:00:00+03:00",
      "2027-05-22T09:00:00+03:00",
      "2027-05-29T09:00:00+03:00",
    ])
    expect(more).toBe(false)
  })

  it("takes several weekdays in order and leaves past days out", () => {
    const { starts } = recurringStarts({
      from: "2027-03-27",
      to: "2027-04-04",
      weekdays: [0, 6],
      time: "18:30",
      now,
    })
    expect(starts).toEqual(["2027-04-03T18:30:00+03:00", "2027-04-04T18:30:00+03:00"])
  })

  it("stops at the limit and says more matched", () => {
    const { starts, more } = recurringStarts({
      from: "2027-05-01",
      to: "2027-12-31",
      weekdays: [0, 1, 2, 3, 4, 5, 6],
      time: "09:00",
      now,
    })
    expect(starts).toHaveLength(60)
    expect(more).toBe(true)
  })

  it("makes nothing from an incomplete rule", () => {
    const base = { from: "2027-05-01", to: "2027-05-31", weekdays: [6], time: "09:00", now }
    expect(recurringStarts({ ...base, weekdays: [] }).starts).toEqual([])
    expect(recurringStarts({ ...base, time: "9" }).starts).toEqual([])
    expect(recurringStarts({ ...base, to: "2027-04-30" }).starts).toEqual([])
  })
})
