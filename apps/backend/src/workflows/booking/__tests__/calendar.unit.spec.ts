import { kurus } from "../../../lib/money"
import type { Kurus } from "../../../lib/money"
import type { CalendarRow } from "../../../modules/booking/service"
import { calendarDays, placesKey } from "../calendar"
import type { DatedCardProduct } from "../card-facts"
import type { BasePrice, CardShown } from "../card-price"

// No promotion worked out for any place: each at its own price
const NONE = new Map<string, CardShown>()

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
      bases,
      NONE
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
      bases,
      NONE
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
      unpriced,
      NONE
    )
    expect(days).toEqual([
      { date: "2027-03-02", from_price: null, departures: 1 },
      { date: "2027-03-09", from_price: null, departures: 1 },
    ])
  })
})

describe("placesKey", () => {
  const unit = (variant: string, adjustment: number, amount: number) => ({
    variant_id: variant,
    adjustment,
    amount: kurus(amount),
  })
  const prices = new Map<string, BasePrice | null>([
    ["a_adult", { calculated: kurus(150_000), original: kurus(180_000) }],
    ["b_adult", null],
  ])
  const plain = unit("a_adult", 0, 150_000)
  const raised = unit("a_adult", 25_000, 175_000)
  const unpriced = unit("b_adult", 0, 1)
  const all = [plain, raised, unpriced]

  it("keys the places alone: a party whose days share them shares the promoted prices", () => {
    // Order and a place met on several days do not matter
    expect(placesKey(all, prices, "try")).toBe(
      placesKey([unpriced, raised, plain, plain], prices, "TRY")
    )
  })

  it("keys another place, price, sale or currency apart", () => {
    const key = placesKey(all, prices, "try")
    const unsold = new Map<string, BasePrice | null>([
      ["a_adult", { calculated: kurus(150_000), original: kurus(150_000) }],
    ])

    expect(placesKey([raised, unpriced], prices, "try")).not.toBe(key)
    expect(placesKey([unit("a_adult", 0, 140_000)], prices, "try")).not.toBe(
      placesKey([plain], prices, "try")
    )
    expect(placesKey([plain], unsold, "try")).not.toBe(placesKey([plain], prices, "try"))
    expect(placesKey(all, prices, "eur")).not.toBe(key)
  })
})
