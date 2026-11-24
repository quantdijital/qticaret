import { afterEach, describe, expect, it, vi } from "vitest"
import {
  FAILED_HOLD_MS,
  calendarAddress,
  keptMonth,
  loadMonth,
} from "../../../../../packages/themes/atolye/src/parts/date-picker-load"

/**
 * The calendar's months from the storefront (#310 review D2): a month
 * answered is kept for the page's life; a month refused for load (429) or
 * failed (5xx) is not asked again for 30 seconds, then it is.
 */

const statuses: number[] = []
const asked: string[] = []
vi.stubGlobal("fetch", (address: string) => {
  asked.push(address)
  const status = statuses.shift() ?? 200
  const month = new URLSearchParams(address.split("?")[1]).get("month") ?? ""
  return Promise.resolve(
    status === 200
      ? new Response(JSON.stringify({ month, days: [] }))
      : new Response(JSON.stringify({ message: "search.calendar_failed" }), { status })
  )
})

afterEach(() => {
  asked.length = 0
  statuses.length = 0
  vi.restoreAllMocks()
})

const signal = () => new AbortController().signal

describe("the calendar's month loader", () => {
  it("asks for the month with the form's category and party, the default party left out", () => {
    expect(calendarAddress("/api/search/calendar", "2026-12", { category: "doga", pax: "1" })).toBe(
      "/api/search/calendar?month=2026-12&kategori=doga"
    )
    expect(calendarAddress("/api/search/calendar", "2026-12", { category: "", pax: "4" })).toBe(
      "/api/search/calendar?month=2026-12&kisi=4"
    )
  })

  it("keeps an answered month: asked once", async () => {
    const address = "/api/search/calendar?month=2027-03&kisi=9"
    await loadMonth(address, signal())
    await loadMonth(address, signal())
    expect(asked).toEqual([address])
    expect(keptMonth(address)).toBeInstanceOf(Map)
  })

  it.each([429, 502])("holds a %i for 30 seconds before asking again", async (status) => {
    const address = `/api/search/calendar?month=2027-04&kisi=${String(status % 20)}`
    const start = Date.now()
    statuses.push(status)
    await expect(loadMonth(address, signal())).rejects.toThrow()
    expect(keptMonth(address)).toBeNull()
    await expect(loadMonth(address, signal())).rejects.toThrow()
    expect(asked).toEqual([address])
    vi.spyOn(Date, "now").mockReturnValue(start + FAILED_HOLD_MS + 1)
    expect(keptMonth(address)).toBeUndefined()
    await loadMonth(address, signal())
    expect(asked).toEqual([address, address])
  })

  it("does not hold a refused question (400): the next ask goes out", async () => {
    const address = "/api/search/calendar?month=2027-05&kisi=11"
    statuses.push(400)
    await expect(loadMonth(address, signal())).rejects.toThrow()
    expect(keptMonth(address)).toBeUndefined()
  })
})
