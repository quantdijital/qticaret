import { describe, expect, it } from "vitest"
import { hourText, readSchedule, trHour, withinSmsHours } from "./schedule"

const NOW = new Date("2026-11-03T09:00:00Z").getTime()

describe("readSchedule (adr/0050 §6)", () => {
  it("asks for a moment when none is typed", () => {
    expect(readSchedule("", NOW)).toEqual({ at: null, problem: "required" })
  })

  it("refuses a moment past or 90 days and more ahead", () => {
    expect(readSchedule("2026-11-01T10:00", NOW).problem).toBe("past")
    expect(readSchedule("2027-03-01T10:00", NOW).problem).toBe("tooFar")
  })

  it("gives a moment ahead with its offset, as the backend takes it", () => {
    const read = readSchedule("2026-11-10T10:30", NOW)
    expect(read.problem).toBeNull()
    expect(read.at).toMatch(/^2026-11-10T10:30:00[+-]\d{2}:\d{2}$/)
    expect(new Date(read.at ?? "").getTime()).toBe(new Date("2026-11-10T10:30").getTime())
  })
})

describe("SMS hours (Türkiye time)", () => {
  it("reads the hour in Türkiye and keeps texts within the window", () => {
    expect(trHour(new Date("2026-11-03T05:59:00Z"))).toBe(8)
    expect(withinSmsHours(new Date("2026-11-03T05:59:00Z"), 9, 20)).toBe(false)
    expect(withinSmsHours(new Date("2026-11-03T06:00:00Z"), 9, 20)).toBe(true)
    expect(withinSmsHours(new Date("2026-11-03T17:00:00Z"), 9, 20)).toBe(false)
    expect(hourText(9)).toBe("09:00")
  })
})
