import { kurus } from "../../money"
import {
  BOOKING_KEY,
  adjustmentOf,
  adjustmentProblem,
  bookingMarkOf,
  bookingUnitPrice,
  paxOf,
  salesClosed,
  unitsOf,
} from "../cart-lines"

describe("dated cart lines (adr/0076 §4, §5)", () => {
  it("prices a line from the variant's price and the departure's difference, never below zero", () => {
    expect(bookingUnitPrice(kurus(150_000), 25_000)).toBe(175_000)
    expect(bookingUnitPrice(kurus(150_000), -50_000)).toBe(100_000)
    expect(bookingUnitPrice(kurus(150_000), -200_000)).toBe(0)
    expect(bookingUnitPrice(kurus(0), 0)).toBe(0)
  })

  it("reads a departure's difference in kuruş, 0 when the variant has none", () => {
    expect(adjustmentOf({ variant_a: 2500 }, "variant_a")).toBe(2500)
    expect(adjustmentOf({ variant_a: 2500 }, "variant_b")).toBe(0)
    expect(adjustmentOf(null, "variant_a")).toBe(0)
  })

  it("refuses a difference in a currency other than lira, and lets no difference through anywhere", () => {
    expect(adjustmentProblem("try", 2500)).toBeNull()
    expect(adjustmentProblem("TRY", -100)).toBeNull()
    expect(adjustmentProblem("eur", 0)).toBeNull()
    expect(adjustmentProblem("eur", 2500)).toBe("booking.currency_unsupported")
  })

  it("counts places as quantity times pax, a variant left out taking one and an infant none", () => {
    const pax = { adult: { pax: 1 }, infant: { pax: 0 }, family: { pax: 4 } }

    expect(paxOf(pax, "infant")).toBe(0)
    expect(paxOf(pax, "family")).toBe(4)
    expect(paxOf(pax, "child")).toBe(1)
    expect(paxOf(null, "adult")).toBe(1)
    expect(
      unitsOf(
        [
          { variant_id: "adult", quantity: 2 },
          { variant_id: "infant", quantity: 1 },
          { variant_id: "family", quantity: 1 },
          { variant_id: "child", quantity: 3 },
        ],
        pax
      )
    ).toBe(9)
    expect(unitsOf([{ variant_id: "infant", quantity: 2 }], pax)).toBe(0)
  })

  it("closes sales at the cutoff before the departure", () => {
    const startsAt = new Date("2026-12-01T09:00:00Z")

    expect(salesClosed(startsAt, 24, new Date("2026-11-30T08:59:59Z"))).toBe(false)
    expect(salesClosed(startsAt, 24, new Date("2026-11-30T09:00:00Z"))).toBe(true)
    expect(salesClosed(startsAt, 0, new Date("2026-12-01T08:59:00Z"))).toBe(false)
    expect(salesClosed(startsAt, 0, new Date("2026-12-01T09:00:00Z"))).toBe(true)
  })

  it("reads only a whole booking mark", () => {
    const mark = { hold_id: "bkhold_1", slot_id: "bkslot_1", starts_at: "2026-12-01", pax: 1 }

    expect(bookingMarkOf({ [BOOKING_KEY]: mark, other: 1 })).toEqual(mark)
    expect(bookingMarkOf({ [BOOKING_KEY]: { ...mark, pax: -1 } })).toBeNull()
    expect(bookingMarkOf({ [BOOKING_KEY]: { ...mark, hold_id: 5 } })).toBeNull()
    expect(bookingMarkOf({ [BOOKING_KEY]: "x" })).toBeNull()
    expect(bookingMarkOf(null)).toBeNull()
  })
})
