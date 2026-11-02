import { describe, expect, it } from "vitest"
import { daysOf, hoursIssues, mondayToWeekdays, rangesOf, withBreak } from "./opening-hours"
import type { DayHours } from "./opening-hours"

const open = (...ranges: [string, string][]): DayHours => ({
  open: true,
  ranges: ranges.map(([opens, closes]) => ({ opens, closes })),
})
const closed: DayHours = { open: false, ranges: [{ opens: "09:00", closes: "18:00" }] }

describe("opening hours", () => {
  it("reads the stored ranges as seven days and writes them back, midnight as 24:00", () => {
    const days = daysOf([
      { day: 1, opens: "09:00", closes: "12:00" },
      { day: 1, opens: "13:00", closes: "18:00" },
      { day: 7, opens: "20:00", closes: "24:00" },
    ])

    expect(days).toHaveLength(7)
    expect(days[0]).toEqual(open(["09:00", "12:00"], ["13:00", "18:00"]))
    expect(days[1]).toEqual(closed)
    expect(days[6]).toEqual(open(["20:00", "00:00"]))
    expect(rangesOf(days)).toEqual([
      { day: 1, opens: "09:00", closes: "12:00" },
      { day: 1, opens: "13:00", closes: "18:00" },
      { day: 7, opens: "20:00", closes: "24:00" },
    ])
  })

  it("leaves a closed day out and sorts a day's ranges by opening", () => {
    const days = [open(["14:00", "18:00"], ["09:00", "12:00"]), closed]

    expect(rangesOf(days)).toEqual([
      { day: 1, opens: "09:00", closes: "12:00" },
      { day: 1, opens: "14:00", closes: "18:00" },
    ])
  })

  it("finds a missing time, a range closing before it opens and an overlap, on open days only", () => {
    expect(
      hoursIssues([
        open(["09:00", ""], ["18:00", "10:00"]),
        open(["09:00", "13:00"], ["12:00", "18:00"]),
        open(["22:00", "00:00"]),
        { open: false, ranges: [{ opens: "18:00", closes: "09:00" }] },
      ])
    ).toEqual([["required", "backwards"], [null, "overlap"], [null], [null]])
    // Touching ranges do not overlap
    expect(hoursIssues([open(["09:00", "12:00"], ["12:00", "18:00"])])).toEqual([[null, null]])
  })

  it("adds a lunch break when it fits, else an hour in the middle, else a range after", () => {
    expect(withBreak(open(["09:00", "18:00"]).ranges)).toEqual(
      open(["09:00", "12:00"], ["13:00", "18:00"]).ranges
    )
    expect(withBreak(open(["13:00", "19:00"]).ranges)).toEqual(
      open(["13:00", "15:30"], ["16:30", "19:00"]).ranges
    )
    expect(withBreak(open(["17:00", "19:00"]).ranges)).toEqual(
      open(["17:00", "19:00"], ["19:00", "20:00"]).ranges
    )
    expect(withBreak(open(["23:00", "00:00"]).ranges)).toEqual(
      open(["23:00", "00:00"], ["", ""]).ranges
    )
  })

  it("copies Monday, open or closed, to Tuesday to Friday and leaves the weekend", () => {
    const sunday = open(["10:00", "14:00"])
    const days = [open(["08:00", "17:00"]), closed, closed, closed, closed, closed, sunday]

    const copied = mondayToWeekdays(days)

    expect(copied.slice(0, 5)).toEqual(Array(5).fill(open(["08:00", "17:00"])))
    expect(copied[5]).toEqual(closed)
    expect(copied[6]).toBe(sunday)
    // Copies, not the same rows: editing Tuesday leaves Monday alone
    expect(copied[1]?.ranges).not.toBe(copied[0]?.ranges)
  })
})
