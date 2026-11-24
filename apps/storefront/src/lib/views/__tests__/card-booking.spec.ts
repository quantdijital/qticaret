import { describe, expect, it } from "vitest"
import type { ProductCardView } from "@qticaret/ui"
import { t } from "@/lib/i18n"
import { shortDeparture, withCardBooking } from "../card-booking"
import { withCardFacts } from "../card-extras"

// adr/0076 §10: a dated product's card says its from price and next departure
const card = (id: string, over: Partial<ProductCardView> = {}): ProductCardView => ({
  id,
  title: `Tur ${id}`,
  path: `/urun/${id}`,
  brand: null,
  image: null,
  // The card's own lowest price: an infant's
  price: { current: "0,00 TL", before: null, from: true, discount: null },
  available: true,
  ...over,
})

const booking = {
  from_price: 1750.5,
  currency_code: "try",
  // 06:00 UTC is 09:00 in Istanbul; 23:30 UTC on the 11th is the 12th there
  next_departure: "2026-12-11T23:30:00.000Z",
  timezone: "Europe/Istanbul",
}

describe("shortDeparture", () => {
  it("says the day and short month in the product's zone", () => {
    expect(shortDeparture("2026-12-11T23:30:00.000Z", "Europe/Istanbul")).toBe("12 Ara")
    expect(shortDeparture("2026-12-11T23:30:00.000Z", "UTC")).toBe("11 Ara")
  })

  it("falls back to Istanbul for an unknown zone, and says nothing of a bad time", () => {
    expect(shortDeparture("2026-12-11T23:30:00.000Z", "Mars/Olympus")).toBe("12 Ara")
    expect(shortDeparture("not-a-time")).toBeNull()
  })
})

describe("withCardBooking", () => {
  it("puts the server's from price in place of the card's and the next departure under it", () => {
    expect(withCardBooking(card("a"), booking)).toEqual({
      ...card("a"),
      price: { current: "1.750,50 TL", before: null, from: true, discount: null },
      booking: { next: "12 Ara", nextAt: "2026-12-11T23:30:00.000Z" },
    })
  })

  it("says no departure when none is on sale, and no price when none has one", () => {
    const read = withCardBooking(card("a"), {
      ...booking,
      from_price: null,
      next_departure: null,
    })
    expect(read.price).toBeNull()
    expect(read.booking).toEqual({ next: null, nextAt: null })
  })

  it("keeps the card's own price in a currency it does not word", () => {
    const read = withCardBooking(card("a"), { ...booking, currency_code: "eur" })
    expect(read.price).toEqual(card("a").price)
    expect(read.booking?.next).toBe("12 Ara")
  })

  it("leaves any other card as it was", () => {
    expect(withCardBooking(card("a"), undefined)).toEqual(card("a"))
  })

  // adr/0076 Ek "kart fiyatı promosyonlu": the server's promoted price, struck through by its rule
  it("strikes the price before an automatic promotion through when the server sends one", () => {
    const read = withCardBooking(card("a"), { ...booking, from_price: 1400.4, before: 1750.5 })
    expect(read.price).toEqual({
      current: "1.400,40 TL",
      before: "1.750,50 TL",
      from: true,
      discount: 20,
      saving: "350,10 TL",
    })
    // None sent, or none above the price: drawn as before
    expect(withCardBooking(card("a"), booking).price?.before).toBeNull()
    const odd = withCardBooking(card("a"), { ...booking, before: 1750.5 })
    expect(odd.price).toEqual({ current: "1.750,50 TL", before: null, from: true, discount: null })
  })

  // adr/0077 §4: a date search's card
  it("says the departure is inside the dates asked and its places left when few", () => {
    const read = withCardBooking(card("a"), { ...booking, left: 3, in_range: true })
    expect(read.booking).toEqual({
      next: "12 Ara",
      nextAt: "2026-12-11T23:30:00.000Z",
      left: 3,
      inRange: true,
    })
    // At the threshold still; above it, none
    expect(withCardBooking(card("a"), { ...booking, left: 5 }).booking?.left).toBe(5)
    expect(withCardBooking(card("a"), { ...booking, left: 6 }).booking).not.toHaveProperty("left")
  })

  it("says no places left without a departure, nor a full or unknown one", () => {
    const none = withCardBooking(card("a"), {
      ...booking,
      next_departure: null,
      left: 2,
      in_range: true,
    })
    expect(none.booking).toEqual({ next: null, nextAt: null })
    expect(withCardBooking(card("a"), { ...booking, left: 0 }).booking).not.toHaveProperty("left")
    expect(withCardBooking(card("a"), { ...booking, left: null }).booking).toEqual({
      next: "12 Ara",
      nextAt: "2026-12-11T23:30:00.000Z",
    })
  })
})

describe("withCardFacts with a dated product", () => {
  it("adds the booking view to a dated card only", () => {
    const [dated, plain] = withCardFacts(
      [
        card("a"),
        card("b", { price: { current: "100,00 TL", before: null, from: false, discount: null } }),
      ],
      {
        a: { stock: "in_stock", quick_add: null, booking },
        b: { stock: "in_stock", quick_add: { variant_id: "variant_b" } },
      },
      { showRating: false },
      t
    )
    expect(dated).toMatchObject({
      price: { current: "1.750,50 TL", from: true },
      booking: { next: "12 Ara" },
      quickAdd: null,
    })
    expect(plain).not.toHaveProperty("booking")
    expect(plain?.price?.current).toBe("100,00 TL")
  })

  // adr/0077 Ek "tur kartı": the tour's length in words, only while the shop shows it
  it("says the tour's length only on a card whose look asks for it", () => {
    const look = {
      over: false,
      ratingBadge: false,
      arrow: false,
      duration: true,
      perPerson: false,
    }
    const facts = {
      a: { stock: "in_stock" as const, quick_add: null, booking: { ...booking, duration_days: 5 } },
    }
    const [shown] = withCardFacts([card("a", { look })], facts, { showRating: false }, t)
    const [hidden] = withCardFacts([card("a")], facts, { showRating: false }, t)
    const [none] = withCardFacts(
      [card("a", { look })],
      { a: { stock: "in_stock", quick_add: null, booking } },
      { showRating: false },
      t
    )
    expect(shown?.booking?.duration).toBe("5 gün • 4 gece")
    expect(hidden?.booking).not.toHaveProperty("duration")
    expect(none?.booking).not.toHaveProperty("duration")
  })
})
