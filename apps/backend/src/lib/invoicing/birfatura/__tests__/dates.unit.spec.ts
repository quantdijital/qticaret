import { formatBirfaturaDate, parseBirfaturaDate, pullRange } from "../dates"

describe("BirFatura's dates, dd.MM.yyyy HH:mm:ss in Türkiye's time (adr/0072 §5)", () => {
  it("writes a moment in Türkiye's time, padded", () => {
    expect(formatBirfaturaDate(new Date("2026-07-16T07:30:00Z"))).toBe("16.07.2026 10:30:00")
    expect(formatBirfaturaDate(new Date("2026-12-31T21:05:09Z"))).toBe("01.01.2027 00:05:09")
  })

  it("reads one back to the same moment", () => {
    const at = new Date("2026-11-18T09:15:42Z")

    expect(parseBirfaturaDate(formatBirfaturaDate(at))?.toISOString()).toBe(at.toISOString())
    expect(parseBirfaturaDate("16.07.2026 10:30:00")?.toISOString()).toBe(
      "2026-07-16T07:30:00.000Z"
    )
  })

  it.each([
    ["a day that does not exist", "31.02.2026 10:00:00"],
    ["an hour past 23", "16.07.2026 24:00:00"],
    ["ISO", "2026-07-16T10:30:00"],
    ["no time", "16.07.2026"],
    ["a single digit", "6.7.2026 10:30:00"],
    ["nothing", ""],
  ])("refuses %s", (_name, text) => {
    expect(parseBirfaturaDate(text)).toBeNull()
  })

  it("takes a range of up to 31 days, start before end", () => {
    const range = pullRange("01.11.2026 00:00:00", "02.12.2026 00:00:00")

    expect(range).toEqual({
      start: new Date("2026-10-31T21:00:00Z"),
      end: new Date("2026-12-01T21:00:00Z"),
    })
  })

  it("refuses a wider range, an inverted one or a broken date", () => {
    expect(pullRange("01.11.2026 00:00:00", "02.12.2026 00:00:01")).toEqual({
      problem: "range_too_wide",
    })
    expect(pullRange("02.11.2026 00:00:00", "01.11.2026 00:00:00")).toEqual({
      problem: "range_invalid",
    })
    expect(pullRange("2026-11-01", "02.11.2026 00:00:00")).toEqual({ problem: "range_invalid" })
  })
})
