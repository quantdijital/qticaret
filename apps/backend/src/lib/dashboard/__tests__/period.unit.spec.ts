import { bucketIndex, periodWindow, startOfTurkishDay } from "../period"

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
