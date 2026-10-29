import {
  bucketIndex,
  periodWindow,
  rangeWindow,
  startOfTurkishDay,
  turkishDay,
  turkishDayStart,
} from "../period"

// 14:30 in Istanbul on 26 October 2026
const NOW = new Date("2026-10-26T11:30:00Z")

describe("periodWindow", () => {
  it("starts the day at midnight in Turkey, not UTC", () => {
    expect(startOfTurkishDay(new Date("2026-10-25T22:30:00Z")).toISOString()).toBe(
      "2026-10-25T21:00:00.000Z"
    )
    expect(startOfTurkishDay(NOW).toISOString()).toBe("2026-10-25T21:00:00.000Z")
  })

  it("splits today into hours so far, against the same hours of yesterday", () => {
    const window = periodWindow("today", NOW)

    expect(window.granularity).toBe("hour")
    expect(window.buckets).toHaveLength(15)
    expect(window.from.toISOString()).toBe("2026-10-25T21:00:00.000Z")
    expect(window.previousFrom.toISOString()).toBe("2026-10-24T21:00:00.000Z")
    expect(window.previousTo.toISOString()).toBe("2026-10-25T11:30:00.000Z")
  })

  it("takes the last 30 days, today included, against the 30 before", () => {
    const window = periodWindow("30d", NOW)

    expect(window.buckets).toHaveLength(30)
    expect(window.from.toISOString()).toBe("2026-09-26T21:00:00.000Z")
    expect(window.previousFrom.toISOString()).toBe("2026-08-27T21:00:00.000Z")
    expect(window.buckets.at(-1)?.toISOString()).toBe("2026-10-25T21:00:00.000Z")
  })
})

describe("bucketIndex", () => {
  it("places an instant in its bucket and refuses one outside", () => {
    const window = periodWindow("7d", NOW)
    const count = window.buckets.length

    expect(bucketIndex(window.from, window.bucketMs, count, window.from)).toBe(0)
    expect(bucketIndex(window.from, window.bucketMs, count, NOW)).toBe(6)
    expect(bucketIndex(window.from, window.bucketMs, count, window.previousFrom)).toBe(-1)
  })
})

describe("rangeWindow (F11.1)", () => {
  // 2026-10-29 15:30 in Turkey
  const now = new Date("2026-10-29T12:30:00Z")

  it("takes Turkish days, both included, against as many days before", () => {
    const window = rangeWindow("2026-10-01", "2026-10-07", now)

    expect(window?.from.toISOString()).toBe("2026-09-30T21:00:00.000Z")
    expect(window?.to.toISOString()).toBe("2026-10-07T21:00:00.000Z")
    expect(window?.previousFrom.toISOString()).toBe("2026-09-23T21:00:00.000Z")
    expect(window?.buckets).toHaveLength(7)
    expect(window).toMatchObject({ key: "range", granularity: "day" })
  })

  it("reads one day by hour, and a range into today up to now", () => {
    const day = rangeWindow("2026-10-28", "2026-10-28", now)
    const running = rangeWindow("2026-10-27", "2026-10-29", now)

    expect(day).toMatchObject({ granularity: "hour" })
    expect(day?.buckets).toHaveLength(24)
    expect(running?.to).toEqual(now)
    expect(running?.buckets).toHaveLength(3)
  })

  it("refuses a range that is no range", () => {
    expect(rangeWindow("2026-10-07", "2026-10-01", now)).toBeNull()
    expect(rangeWindow("2026-11-01", "2026-11-02", now)).toBeNull()
    expect(rangeWindow("2025-01-01", "2026-01-02", now)).toBeNull()
    expect(rangeWindow("2026-02-30", "2026-03-01", now)).toBeNull()
    expect(rangeWindow("1.10.2026", "2026-10-02", now)).toBeNull()
    // A year and a day is allowed
    expect(rangeWindow("2025-10-29", "2026-10-29", now)?.buckets).toHaveLength(366)
  })

  it("names an instant's day as Turkey does", () => {
    expect(turkishDay(new Date("2026-10-28T21:30:00Z"))).toBe("2026-10-29")
    expect(turkishDayStart("2026-10-29")?.toISOString()).toBe("2026-10-28T21:00:00.000Z")
  })
})
