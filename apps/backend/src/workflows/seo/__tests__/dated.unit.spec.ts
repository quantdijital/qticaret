import { kurus } from "../../../lib/money"
import type { Kurus } from "../../../lib/money"
import type { SlotAvailability } from "../../../modules/booking/service"
import type { ReturnsSettings } from "../../../modules/platform-settings/sections"
import type { DatedCardProduct } from "../../booking/card-facts"
import type { CardShown } from "../../booking/card-price"
import { isDated } from "../../marketing/feed-catalog"
import { departureFactsOf } from "../dated-facts"
import { productFacts } from "../facts"
import type { FactRow, ShippingFacts } from "../facts"

// adr/0076 §10: a dated product's structured data facts, and its place in the feeds

const NOW = new Date("2026-12-01T09:00:00.000Z")
const HOUR = 60 * 60 * 1000

// No promotion worked out for any place: each at its own price
const NONE = new Map<string, CardShown>()

const trip: DatedCardProduct = {
  id: "prod_trip",
  variants: [{ id: "adult" }, { id: "infant" }],
  product_extension: { booking_mode: "departure" },
  bookable: {
    id: "bkbl_1",
    cutoff_hours: 24,
    pax_by_variant: { infant: { pax: 0 } },
    timezone: "Europe/Istanbul",
  },
}

const bases = new Map<string, Kurus | null>([
  ["adult", kurus(750_000)],
  ["infant", kurus(0)],
])

const slot = (id: string, hoursAhead: number, extra: Partial<SlotAvailability> = {}) => ({
  id,
  bookable_id: "bkbl_1",
  starts_at: new Date(NOW.getTime() + hoursAhead * HOUR),
  ends_at: new Date(NOW.getTime() + (hoursAhead + 48) * HOUR),
  status: "open" as const,
  capacity: 10,
  sold: 0,
  held: 0,
  available: 10,
  price_adjustments: null,
  ...extra,
})

describe("departureFactsOf", () => {
  it("names the departures still on sale with a paying place's price, each its own difference", () => {
    const facts = departureFactsOf(
      trip,
      bases,
      [
        // Its sales closed a day before: not named
        slot("soon", 12),
        slot("s1", 48, { price_adjustments: { adult: 50_000 } }),
        slot("s2", 96, { available: 0 }),
      ],
      NOW,
      NONE
    )
    expect(facts).toEqual([
      {
        startsAt: new Date(NOW.getTime() + 48 * HOUR).toISOString(),
        endsAt: new Date(NOW.getTime() + 96 * HOUR).toISOString(),
        price: 8000,
        available: true,
      },
      expect.objectContaining({ price: 7500, available: false }),
    ])
  })

  it("names none when every departure has passed", () => {
    expect(departureFactsOf(trip, bases, [], NOW, NONE)).toEqual([])
  })
})

const row = (extension: NonNullable<FactRow["product_extension"]> | null): FactRow => ({
  title: "Kapadokya Turu",
  handle: "kapadokya-turu",
  product_extension: extension,
  variants: [
    {
      id: "adult",
      title: "Yetişkin",
      manage_inventory: false,
      prices: [{ amount: 7500, currency_code: "try" }],
    },
  ],
})

describe("a dated product's offers", () => {
  const shipping: ShippingFacts = {
    settings: {
      handling_days_min: 1,
      handling_days_max: 2,
      transit_days_min: 1,
      transit_days_max: 3,
      same_day_cutoff_hour: null,
      rate_table: [{ max_desi: 2, price: 4_990 }],
      over_desi_price: 0,
      label_format: "100x150",
      label_custom: { width_mm: 100, height_mm: 150 },
      default_parcel: { weight: 500, length: 10, width: 10, height: 10 },
      packing_slip_prices: false,
      shipping_classes: [],
      primary_option_id: null,
    },
    units: { weight_unit: "g", dimension_unit: "cm" },
    table_offered: true,
    free_shipping_threshold: null,
  }
  const returns = { withdrawal_days: 14 } as ReturnsSettings

  it("name no delivery or return policy; a service sold otherwise still has its returns", () => {
    const dated = productFacts(
      row({ kind: "service", booking_mode: "departure" }),
      null,
      "",
      undefined,
      shipping,
      returns
    )
    expect(dated.delivery).toBeNull()
    expect(dated.returnPolicy).toBeNull()
    const service = productFacts(
      row({ kind: "service", booking_mode: "none" }),
      null,
      "",
      undefined,
      shipping,
      returns
    )
    expect(service.returnPolicy).toMatchObject({ days: 14 })
  })

  it("leave the product out of the shopping feeds", () => {
    expect(isDated(row({ kind: "service", booking_mode: "departure" }))).toBe(true)
    expect(isDated(row({ kind: "service", booking_mode: "none" }))).toBe(false)
    expect(isDated(row({ kind: "physical" }))).toBe(false)
    expect(isDated(row(null))).toBe(false)
  })
})
