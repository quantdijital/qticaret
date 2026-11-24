import { kurus } from "../../../lib/money"
import type { Kurus } from "../../../lib/money"
import type { SlotAvailability } from "../../../modules/booking/service"
import { bookingCardFactOf, cardUnits } from "../card-facts"
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
  it("gives the nearest departure on sale and the main category's lowest price over the sold ones, not a cheaper child's", () => {
    const fact = bookingCardFactOf(
      tour,
      bases,
      [slot("s1", 48, { price_adjustments: { child: 25_050 } }), slot("s2", 96)],
      "try",
      NOW
    )
    expect(fact).toEqual({
      from_price: 1500,
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
    expect(fact).toMatchObject({ from_price: 1500, next_departure: null })
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

  it("says a date search's card's places left and marks it in range (adr/0077 §4)", () => {
    const fact = bookingCardFactOf(
      tour,
      bases,
      [slot("s1", 48, { available: 3 }), slot("s2", 96)],
      "try",
      NOW,
      true
    )
    expect(fact).toMatchObject({
      from_price: 1500,
      next_departure: new Date(NOW.getTime() + 48 * HOUR).toISOString(),
      left: 3,
      in_range: true,
    })
    // None inside the dates: no departure, no places, the base prices
    expect(bookingCardFactOf(tour, bases, [], "try", NOW, true)).toMatchObject({
      next_departure: null,
      left: null,
      in_range: true,
    })
    // Without dates the fact has neither field
    const plain = bookingCardFactOf(tour, bases, [slot("s1", 48)], "try", NOW)
    expect(plain).not.toHaveProperty("left")
    expect(plain).not.toHaveProperty("in_range")
  })

  it("takes its places one per category, each at its lowest departure (adr/0076 Ek promosyonlu)", () => {
    const slots = [
      slot("s1", 48, { price_adjustments: { adult: 25_050 } }),
      slot("s2", 96, { price_adjustments: { adult: -10_000 } }),
      slot("late", 2, { price_adjustments: { adult: -50_000 } }),
    ]
    expect(cardUnits(tour, bases, slots, "try", NOW)).toEqual([
      { variant_id: "adult", adjustment: -10_000, amount: 140_000 },
    ])
    // No departure on sale: the base price, no difference
    expect(cardUnits(tour, bases, [], "try", NOW)).toEqual([
      { variant_id: "adult", adjustment: 0, amount: 150_000 },
    ])
  })

  it("says the promoted price, struck through only when the display allows; as before without one", () => {
    const slots = [slot("s1", 48)]
    const promoted = bookingCardFactOf(
      tour,
      bases,
      slots,
      "try",
      NOW,
      false,
      new Map([["adult", { current: kurus(120_000), before: kurus(150_000) }]])
    )
    expect(promoted).toMatchObject({ from_price: 1200, before: 1500 })
    // A discount the price-before rule does not show: the price, nothing struck through
    const hidden = bookingCardFactOf(
      tour,
      bases,
      slots,
      "try",
      NOW,
      true,
      new Map([["adult", { current: kurus(120_000), before: null }]])
    )
    expect(hidden).toMatchObject({ from_price: 1200, in_range: true })
    expect(hidden).not.toHaveProperty("before")
    // Without a promotion the fact is as it was, with no `before`
    const plain = bookingCardFactOf(
      tour,
      bases,
      slots,
      "try",
      NOW,
      false,
      new Map([["adult", { current: kurus(150_000), before: null }]])
    )
    expect(plain).toEqual(bookingCardFactOf(tour, bases, slots, "try", NOW))
    expect(plain).not.toHaveProperty("before")
  })

  it("prices the main category by the shop's order, the next one when it has no price", () => {
    const ranked: DatedCardProduct = {
      ...tour,
      variants: [
        { id: "child", variant_rank: 1 },
        { id: "infant", variant_rank: 2 },
        { id: "adult", variant_rank: 0 },
      ],
    }
    const slots = [slot("s1", 48, { price_adjustments: { adult: -20_000 } }), slot("s2", 96)]
    // The adult ranks first: its cheaper departure, not the child's lower base
    expect(bookingCardFactOf(ranked, bases, slots, "try", NOW)?.from_price).toBe(1300)
    // The adult has no price: the child speaks
    const noAdult = new Map(bases)
    noAdult.set("adult", null)
    expect(bookingCardFactOf(ranked, noAdult, slots, "try", NOW)?.from_price).toBe(900)
  })
})
