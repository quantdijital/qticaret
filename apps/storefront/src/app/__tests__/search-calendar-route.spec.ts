import { beforeEach, describe, expect, it, vi } from "vitest"
import { StoreApiError } from "@/lib/store-api/errors"

const listings = vi.hoisted(() => ({ departureCalendar: vi.fn() }))
vi.mock("@/lib/store-api/listings", () => listings)
vi.mock("@/lib/views/search-form-data", () => ({ shopToday: () => "2026-11-24" }))

const { GET } = await import("../api/search/calendar/route")

const ask = (query: string) => GET(new Request(`http://localhost:8000/api/search/calendar${query}`))

/**
 * adr/0077 §6 (PR6): the search box's calendar asks the storefront for a
 * month; the storefront checks the question before the backend hears it
 * and writes the prices it only shows.
 */
describe("GET /api/search/calendar", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    listings.departureCalendar.mockResolvedValue({
      month: "2026-12",
      currency: "try",
      days: [
        { date: "2026-12-05", from_price: 12400, departures: 2 },
        { date: "2026-12-12", from_price: null, departures: 1 },
        // Not the month asked: never shown
        { date: "2027-01-02", from_price: 900, departures: 1 },
      ],
    })
  })

  it("passes a good question on and writes each day's price, kept a minute by the browser only", async () => {
    const response = await ask("?month=2026-12&kategori=doga-turlari&kisi=3")
    expect(response.status).toBe(200)
    expect(response.headers.get("cache-control")).toBe("private, max-age=60")
    expect(listings.departureCalendar).toHaveBeenCalledWith({
      month: "2026-12",
      kategori: "doga-turlari",
      kisi: "3",
    })
    expect(await response.json()).toEqual({
      month: "2026-12",
      days: [
        {
          date: "2026-12-05",
          departures: 2,
          price: "12.400,00 TL",
          // Intl keeps the number and its unit together with a no-break space
          short: "₺12,4\u00a0B",
          whole: "₺12.400",
        },
        { date: "2026-12-12", departures: 1, price: null, short: null, whole: null },
      ],
    })
  })

  it("leaves the default party and an empty category out of the backend's question", async () => {
    await ask("?month=2026-11&kategori=&kisi=1")
    expect(listings.departureCalendar).toHaveBeenCalledWith({ month: "2026-11" })
  })

  it.each([
    ["no month", ""],
    ["a month before this one", "?month=2026-10"],
    ["a month past the twelve a search reads", "?month=2027-11"],
    ["a month not so written", "?month=2026-1"],
    ["a party of none", "?month=2026-12&kisi=0"],
    ["a party over twenty", "?month=2026-12&kisi=21"],
    ["a category not a handle", "?month=2026-12&kategori=Doğa%20Turları"],
    ["a parameter the calendar does not read", "?month=2026-12&q=kapadokya"],
    ["a parameter given twice", "?month=2026-12&month=2027-01"],
  ])("refuses %s before asking the backend", async (_, query) => {
    const response = await ask(query)
    expect(response.status).toBe(400)
    expect(response.headers.get("cache-control")).toBe("private, no-store")
    expect(listings.departureCalendar).not.toHaveBeenCalled()
  })

  it("answers no days while the shop sells no dated products (the backend's 404)", async () => {
    listings.departureCalendar.mockRejectedValue(new StoreApiError(404, "not_found", null))
    const response = await ask("?month=2026-12")
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ month: "2026-12", days: [] })
  })

  it("passes the backend's 429 on and answers any other failure with a 502", async () => {
    listings.departureCalendar.mockRejectedValueOnce(new StoreApiError(429, "rate_limited", null))
    expect((await ask("?month=2026-12")).status).toBe(429)
    listings.departureCalendar.mockRejectedValueOnce(new Error("down"))
    expect((await ask("?month=2026-12")).status).toBe(502)
  })
})
