import { describe, expect, it } from "vitest"
import type { CheckoutSummaryView } from "@qticaret/ui"
import { t } from "@/lib/i18n"
import type { StoreCartBooking, StoreProductBooking } from "@/lib/booking/store"
import {
  EMPTY_BOOKING,
  FEW_LEFT,
  agesOf,
  bookingMarkOf,
  bookingViewOf,
  departureLabel,
  hasBookingLines,
  holdViewOf,
  lineBookingOf,
  withBookingRead,
} from "../booking"
import { withBookingSummary } from "../checkout-summary"

const BOOKING: StoreProductBooking = {
  cutoff_hours: 24,
  hold_minutes: 15,
  max_units_per_cart: 8,
  timezone: "Europe/Istanbul",
  currency_code: "try",
  categories: [
    { variant_id: "variant_adult", title: "Yetişkin", pax: 1, min_age: 18, max_age: null },
    { variant_id: "variant_child", title: null, pax: 1, min_age: 6, max_age: 12 },
    { variant_id: "variant_any", title: "Herkes", pax: 1, min_age: null, max_age: null },
  ],
  slots: [
    {
      id: "bkslot_late",
      starts_at: "2026-12-19T06:00:00.000Z",
      ends_at: null,
      status: "closed",
      available: 4,
      prices: [{ variant_id: "variant_adult", amount: 1250.5 }],
    },
    {
      id: "bkslot_soon",
      starts_at: "2026-12-12T06:00:00.000Z",
      ends_at: null,
      status: "open",
      available: 3,
      prices: [
        { variant_id: "variant_adult", amount: 1250.5 },
        { variant_id: "variant_child", amount: 600 },
      ],
    },
    {
      id: "bkslot_full",
      starts_at: "2026-12-14T06:00:00.000Z",
      ends_at: null,
      status: "open",
      available: -2,
      prices: [],
    },
  ],
}

/** 12 Dec 2026 at the time given; the day's word order is ICU's (Node versions differ). */
const said = (time: string) =>
  expect.stringMatching(
    new RegExp(`^(Cumartesi, 12 Aralık 2026|12 Aralık 2026 Cumartesi) · ${time}$`)
  ) as unknown as string

const mark = (slot: string, startsAt = "2026-12-12T06:00:00.000Z") => ({
  qt_booking: { slot_id: slot, starts_at: startsAt, hold_id: "bkhold_1" },
})

const read = (lines: { id: string; held: boolean }[], over: Partial<StoreCartBooking> = {}) =>
  ({
    hold: { expires_at: "2026-12-01T10:15:00.000Z" },
    lines: lines.map((line) => ({
      ...line,
      variant_id: "variant_adult",
      slot_id: "bkslot_soon",
      starts_at: "2026-12-12T06:00:00.000Z",
    })),
    shipping_method_stale: false,
    ...over,
  }) satisfies StoreCartBooking

describe("a dated product page's booking view", () => {
  it("tells the departures soonest first in the product's zone, with server prices in words", () => {
    const view = bookingViewOf(BOOKING, t)
    expect(view.departures.map((each) => each.id)).toEqual([
      "bkslot_soon",
      "bkslot_full",
      "bkslot_late",
    ])
    const [soon] = view.departures
    expect(soon?.label).toEqual(said("09:00"))
    expect(soon?.available).toBe(3)
    expect(soon?.prices[0]?.kurus).toBe(125050)
    expect(soon?.prices[0]?.price).toContain("1.250,50")
    expect(view.fewLeft).toBe(FEW_LEFT)
    expect(view.maxUnits).toBe(8)
  })

  it("shows a closed departure and an overbooked one with no places", () => {
    const view = bookingViewOf(BOOKING, t)
    const byId = new Map(view.departures.map((each) => [each.id, each]))
    expect(byId.get("bkslot_late")).toMatchObject({ status: "closed", available: 0 })
    expect(byId.get("bkslot_full")).toMatchObject({ status: "open", available: 0 })
  })

  it("words each category's ages, and none when the shop set none", () => {
    const view = bookingViewOf(BOOKING, t)
    expect(view.categories.map((each) => each.ages)).toEqual(["18 yaş ve üzeri", "6–12 yaş", null])
    expect(view.categories[1]?.title).toBe("")
    expect(agesOf({ variant_id: "v", title: null, pax: 1, min_age: null, max_age: 10 }, t)).toBe(
      "10 yaşa kadar"
    )
  })

  it('offers no departure while dated sales are off or the read failed ("Yakında yeni tarihler")', () => {
    expect(EMPTY_BOOKING.departures).toEqual([])
    expect(EMPTY_BOOKING.maxUnits).toBe(0)
    expect(t("booking.soon")).toBe("Yakında yeni tarihler")
  })
})

describe("a departure's label", () => {
  it("falls back to the default zone for an unknown zone and keeps a broken date as it is", () => {
    expect(departureLabel("2026-12-12T06:00:00.000Z", "Not/AZone")).toEqual(said("09:00"))
    expect(departureLabel("not a date")).toEqual("not a date")
    expect(departureLabel("2026-12-12T06:00:00.000Z", "UTC")).toEqual(said("06:00"))
  })
})

describe("a dated cart line", () => {
  it("reads only a whole booking mark", () => {
    expect(bookingMarkOf(mark("bkslot_soon"))).toEqual({
      slot_id: "bkslot_soon",
      starts_at: "2026-12-12T06:00:00.000Z",
      hold_id: "bkhold_1",
    })
    expect(bookingMarkOf({ qt_booking: { slot_id: "bkslot_soon" } })).toBeNull()
    expect(bookingMarkOf(null)).toBeNull()
    expect(bookingMarkOf({})).toBeNull()
  })

  it("is held without the cart's read and expired once the read says it is not", () => {
    expect(lineBookingOf("cali_1", mark("bkslot_soon"), null)).toEqual({
      departure: said("09:00"),
      expired: false,
    })
    expect(
      lineBookingOf("cali_1", mark("bkslot_soon"), read([{ id: "cali_1", held: false }]))
    ).toMatchObject({ expired: true })
    expect(
      lineBookingOf("cali_1", mark("bkslot_soon"), read([{ id: "cali_2", held: true }]))
    ).toMatchObject({ expired: true })
    expect(lineBookingOf("cali_1", {}, read([]))).toBeNull()
  })

  it("re-tells only the dated lines with the cart's read", () => {
    const lines = [
      { id: "cali_1", booking: { departure: "x", expired: false } },
      { id: "cali_2", booking: null },
    ]
    const items = [
      { id: "cali_1", metadata: mark("bkslot_soon") },
      { id: "cali_2", metadata: null },
    ]
    expect(withBookingRead(lines, items, null)).toBe(lines)
    const told = withBookingRead(lines, items, read([{ id: "cali_1", held: false }]))
    expect(told[0]?.booking).toMatchObject({ expired: true })
    expect(told[1]).toBe(lines[1])
  })
})

describe("the cart's hold", () => {
  const items = [{ metadata: mark("bkslot_soon") }, { metadata: null }]

  it("counts down only with dated lines and the cart's read", () => {
    expect(holdViewOf(items, read([]))).toEqual({ expiresAt: "2026-12-01T10:15:00.000Z" })
    expect(holdViewOf(items, read([], { hold: null }))).toEqual({ expiresAt: null })
    expect(holdViewOf(items, null)).toBeNull()
    expect(holdViewOf([{ metadata: null }], read([]))).toBeNull()
    expect(hasBookingLines(items)).toBe(true)
    expect(hasBookingLines(undefined)).toBe(false)
  })
})

describe("the checkout summary with dated lines", () => {
  const summary = {
    lines: [{ id: "cali_1", booking: { departure: "x", expired: false } }],
  } as unknown as CheckoutSummaryView
  const items = [{ id: "cali_1", metadata: mark("bkslot_soon") }]

  it("stays as it was without the cart's read or without dated lines", () => {
    expect(withBookingSummary(summary, items, null, t)).toBe(summary)
    expect(withBookingSummary(summary, [{ id: "cali_1", metadata: null }], read([]), t)).toBe(
      summary
    )
  })

  it("adds the hold and expires a line whose places are gone", () => {
    const told = withBookingSummary(summary, items, read([{ id: "cali_1", held: false }]), t)
    expect(told.hold).toEqual({ expiresAt: "2026-12-01T10:15:00.000Z" })
    expect(told.lines[0]?.booking).toMatchObject({ expired: true })
    expect(told.notice).toBeUndefined()
  })

  it("says the shipping method was taken off when the read says so", () => {
    const told = withBookingSummary(
      summary,
      items,
      read([{ id: "cali_1", held: true }], { shipping_method_stale: true }),
      t
    )
    expect(told.notice).toBe(t("booking.shipping_stale"))
  })
})
