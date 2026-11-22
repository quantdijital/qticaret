import { localSpans, matchesStatement, spanBounds, windowStatement } from "../matches"

const NOW = new Date("2026-11-23T09:00:00.000Z")
const HOUR = 60 * 60 * 1000

const keyOf = (run: () => unknown): string | undefined => {
  try {
    run()
  } catch (error) {
    return (error as { safeMessage?: string }).safeMessage
  }
  return undefined
}

/** adr/0077 §3: departures found by their dates, in the product's own zone. */
describe("departure matches", () => {
  it("reads a range's days and whole months as local spans, the end excluded", () => {
    expect(localSpans({ ranges: [{ from: "2026-12-30", to: "2026-12-31" }] })).toEqual([
      { from: "2026-12-30", to: "2027-01-01" },
    ])
    expect(localSpans({ months: ["2026-12", "2027-02"] })).toEqual([
      { from: "2026-12-01", to: "2027-01-01" },
      { from: "2027-02-01", to: "2027-03-01" },
    ])
  })

  it("refuses dates no calendar or no search holds as a validation error, not a crash", () => {
    for (const dates of [
      { ranges: [{ from: "9999-12-31", to: "9999-12-31" }] },
      { ranges: [{ from: "2026-02-30", to: "2026-03-02" }] },
      { ranges: [{ from: "2026-12-05", to: "2026-12-01" }] },
      { months: ["9999-12"] },
      { months: ["2026-13"] },
      { months: [] },
      { months: ["2026-12", "2027-01", "2027-02", "2027-03"] },
    ]) {
      expect(keyOf(() => localSpans(dates))).toBe("booking.dates_invalid")
    }
  })

  it("widens each span by any zone's reach for the index, never before now", () => {
    const bounds = spanBounds({ from: "2026-12-01", to: "2026-12-02" }, NOW)
    expect(bounds?.from.toISOString()).toBe(new Date(Date.UTC(2026, 10, 30, 10)).toISOString())
    expect(bounds?.to.toISOString()).toBe(new Date(Date.UTC(2026, 11, 2, 14)).toISOString())
    // A span starting today starts the read now; one long past is not read at all
    expect(spanBounds({ from: "2026-11-23", to: "2026-11-24" }, NOW)?.from).toEqual(NOW)
    expect(spanBounds({ from: "2026-01-01", to: "2026-01-02" }, NOW)).toBeNull()
  })

  it("reads each month apart and binds every value in the order it stands", () => {
    const { sql, params } = matchesStatement(
      { dates: { months: ["2026-12", "2027-02"] }, pax: 3, now: NOW },
      50
    )
    expect(sql.split("?").length - 1).toBe(params.length)
    expect(params).toEqual([
      new Date(Date.UTC(2026, 11, 1) - 14 * HOUR),
      new Date(Date.UTC(2027, 0, 1) + 14 * HOUR),
      "2026-12-01 00:00:00",
      "2027-01-01 00:00:00",
      new Date(Date.UTC(2027, 1, 1) - 14 * HOUR),
      new Date(Date.UTC(2027, 2, 1) + 14 * HOUR),
      "2027-02-01 00:00:00",
      "2027-03-01 00:00:00",
      NOW,
      3,
      3,
      50,
    ])
    // The index's own condition stands as written, the zone's on top of it
    expect(sql).toContain("s.status = 'open' AND s.deleted_at IS NULL")
    expect(sql).toContain("AT TIME ZONE b.timezone")
    expect(sql).toContain("make_interval(hours => b.cutoff_hours)")
    expect(sql).toContain("bh.expires_at > now()")
    // The nearest first, cut in the database
    expect(sql).toMatch(/ORDER BY d\.starts_at, d\.product_id\s+LIMIT \?$/)
  })

  it("narrows to some bookables for a page of cards", () => {
    const { cte, params } = windowStatement(
      { dates: { ranges: [{ from: "2026-12-01", to: "2026-12-05" }] }, pax: 1, now: NOW },
      ["bkbl_1", "bkbl_2"]
    )
    expect(cte.split("?").length - 1).toBe(params.length)
    expect(params.slice(-3)).toEqual(["bkbl_1", "bkbl_2", 1])
  })
})
