import { REPORT_EVERY_MS, reportDue } from "../control-plane-usage"

describe("the usage report's rhythm (adr/0061 §5.4)", () => {
  it("reports on the first run after boot, then hourly", () => {
    const start = Date.UTC(2026, 10, 11, 9, 0, 0)
    expect(reportDue(null, start)).toBe(true)
    expect(reportDue(start, start + 60_000)).toBe(false)
    expect(reportDue(start, start + REPORT_EVERY_MS - 60_000)).toBe(false)
    // A run a few seconds early still counts as the hour's
    expect(reportDue(start, start + REPORT_EVERY_MS - 20_000)).toBe(true)
    expect(reportDue(start, start + 2 * REPORT_EVERY_MS)).toBe(true)
  })
})
