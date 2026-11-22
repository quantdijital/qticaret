import { kurus } from "../../../lib/money"
import type { Kurus } from "../../../lib/money"
import type { SlotAvailability } from "../../../modules/booking/service"
import { bookingCardFactOf } from "../card-facts"
import type { DatedCardProduct } from "../card-facts"

// adr/0076 §10: a dated card's from price and next departure, on the server
const NOW = new Date("2026-12-01T09:00:00.000Z")
const HOUR = 60 * 60 * 1000

const tour: DatedCardProduct = {
  id: "prod_tour",
  variants: [{ id: "adult" }, { id: "child" }, { id: "infant" }],
  product_extension: { booking_mode: "departure" },
  bookable: {
    id: "bkbl_1",
    cutoff_hours: 24,
    pax_by_variant: { infant: { pax: 0 } },
    timezone: "Europe/Istanbul",
  },
}

const bases = new Map<string, Kurus | null>([
  ["adult", kurus(150_000)],
  ["child", kurus(90_000)],
  ["infant", kurus(0)],
])

const slot = (
  id: string,
  hoursAhead: number,
  extra: Partial<SlotAvailability> = {}
): SlotAvailability => ({
  id,
  bookable_id: "bkbl_1",
  starts_at: new Date(NOW.getTime() + hoursAhead * HOUR),
  ends_at: null,
  status: "open",
  capacity: 10,
  sold: 0,
  held: 0,
  available: 10,
  price_adjustments: null,
  ...extra,
})

describe("bookingCardFactOf", () => {
  it("gives the nearest departure on sale and the lowest paying price over the sold ones", () => {
    const fact = bookingCardFactOf(
      tour,
      bases,
      [slot("s1", 48, { price_adjustments: { child: 25_050 } }), slot("s2", 96)],
      "try",
      NOW
    )
    expect(fact).toEqual({
      from_price: 900,
      currency_code: "try",
      next_departure: new Date(NOW.getTime() + 48 * HOUR).toISOString(),
      timezone: "Europe/Istanbul",
    })
  })

  it("leaves out an infant who takes no place, and adds a departure's difference", () => {
    const fact = bookingCardFactOf(
      { ...tour, variants: [{ id: "adult" }, { id: "infant" }] },
      bases,
      [slot("s1", 48, { price_adjustments: { adult: -10_000 } }), slot("s2", 96)],
      "try",
      NOW
    )
    expect(fact?.from_price).toBe(1400)
  })

  it("skips a departure past its sales' close, a full one and a closed one", () => {
    const fact = bookingCardFactOf(
      tour,
      bases,
      [
        slot("late", 10),
        slot("full", 30, { available: 0 }),
        slot("shut", 40, { status: "closed" }),
        slot("next", 72),
      ],
      "try",
      NOW
    )
    expect(fact?.next_departure).toBe(new Date(NOW.getTime() + 72 * HOUR).toISOString())
  })

  it("keeps the base price without a departure on sale, and no departure", () => {
    const fact = bookingCardFactOf(tour, bases, [slot("late", 2)], "try", NOW)
    expect(fact).toMatchObject({ from_price: 900, next_departure: null })
  })

  it("says no price when no category has one, and never prices a difference in another currency", () => {
    expect(bookingCardFactOf(tour, new Map(), [slot("s1", 48)], "try", NOW)?.from_price).toBe(null)
    const euro = bookingCardFactOf(
      { ...tour, variants: [{ id: "adult" }] },
      bases,
      [slot("s1", 48, { price_adjustments: { adult: 5_000 } }), slot("s2", 72)],
      "eur",
      NOW
    )
    expect(euro?.from_price).toBe(1500)
  })

  it("is none for a product that is not dated or has no settings yet", () => {
    expect(
      bookingCardFactOf(
        { ...tour, product_extension: { booking_mode: "none" } },
        bases,
        [],
        "try",
        NOW
      )
    ).toBeNull()
    expect(bookingCardFactOf({ ...tour, bookable: null }, bases, [], "try", NOW)).toBeNull()
  })
})
