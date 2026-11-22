import { kurus } from "../../../lib/money"
import type { Kurus } from "../../../lib/money"
import type { CalendarRow } from "../../../modules/booking/service"
import { calendarDays } from "../calendar"
import type { DatedCardProduct } from "../card-facts"

// adr/0077 §6: a month's days, priced on the server by the card's rule
const tour = (id: string, bookableId: string): DatedCardProduct => ({
  id,
  variants: [{ id: `${id}_adult` }, { id: `${id}_infant` }],
  product_extension: { booking_mode: "departure" },
  bookable: {
    id: bookableId,
    cutoff_hours: 24,
    pax_by_variant: { [`${id}_infant`]: { pax: 0 } },
    timezone: "Europe/Istanbul",
  },
})

const products = new Map<string, DatedCardProduct>([
  ["bk_a", tour("a", "bk_a")],
  ["bk_b", tour("b", "bk_b")],
])

const bases = new Map<string, Kurus | null>([
  ["a_adult", kurus(150_000)],
  ["a_infant", kurus(0)],
  ["b_adult", kurus(120_000)],
  ["b_infant", kurus(0)],
])

const row = (day: string, bookableId: string, extra: Partial<CalendarRow> = {}): CalendarRow => ({
  day,
  bookable_id: bookableId,
  departures: 1,
  adjustments: [null],
  ...extra,
})

describe("calendarDays", () => {
  it("adds up a day's departures over its products and keeps the lowest paying price", () => {
    const days = calendarDays(
      [row("2027-03-05", "bk_a", { departures: 2 }), row("2027-03-05", "bk_b")],
      products,
      bases
    )
    // An infant's free place is no "from" price
    expect(days).toEqual([{ date: "2027-03-05", from_price: 1200, departures: 3 }])
  })

  it("adds each departure's difference, a discount and a surcharge alike", () => {
    const days = calendarDays(
      [
        row("2027-03-06", "bk_a", { adjustments: [{ a_adult: 25_000 }, { a_adult: -40_050 }] }),
        row("2027-03-07", "bk_b", { adjustments: [{ b_adult: 30_000 }] }),
      ],
      products,
      bases
    )
    expect(days).toEqual([
      { date: "2027-03-06", from_price: 1099.5, departures: 1 },
      { date: "2027-03-07", from_price: 1500, departures: 1 },
    ])
  })

  it("orders the days, counts a day without a price, and skips a bookable not asked", () => {
    const unpriced = new Map<string, Kurus | null>([["a_adult", null]])
    const days = calendarDays(
      [row("2027-03-09", "bk_a"), row("2027-03-02", "bk_a"), row("2027-03-04", "bk_other")],
      products,
      unpriced
    )
    expect(days).toEqual([
      { date: "2027-03-02", from_price: null, departures: 1 },
      { date: "2027-03-09", from_price: null, departures: 1 },
    ])
  })
})
