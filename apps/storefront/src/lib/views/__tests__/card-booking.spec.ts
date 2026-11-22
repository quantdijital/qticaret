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
})
