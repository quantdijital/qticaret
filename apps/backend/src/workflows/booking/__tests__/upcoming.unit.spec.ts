import { StoreGetDepartures } from "../../../api/store/departures/validators"
import type { Kurus } from "../../../lib/money"
import type { SlotAvailability } from "../../../modules/booking/service"
import { FEW_LEFT, horizon, upcomingRows } from "../upcoming"
import type { UpcomingProduct } from "../upcoming"
import type { CardShown } from "../card-price"

// No promotion worked out for any place: each at its own price
const NONE = new Map<string, CardShown>()

const tour = (id: string, bookable: string, more: Partial<UpcomingProduct> = {}) =>
  ({
    id,
    handle: `tur-${id}`,
    title: `Tur ${id}`,
    thumbnail: null,
    variants: [{ id: `${id}_adult` }, { id: `${id}_infant` }],
    product_extension: { booking_mode: "departure" },
    bookable: {
      id: bookable,
      cutoff_hours: 24,
      // The infant takes no place: not a "from" price
      pax_by_variant: { [`${id}_infant`]: { pax: 0 } },
      timezone: "Europe/Istanbul",
    },
    ...more,
  }) satisfies UpcomingProduct

const slot = (
  id: string,
  bookable: string,
  at: string,
  available: number,
  adjustments: Record<string, number> | null = null
): SlotAvailability => ({
  id,
  bookable_id: bookable,
  starts_at: new Date(at),
  ends_at: null,
  status: "open",
  capacity: 20,
  sold: 20 - available,
  held: 0,
  available,
  price_adjustments: adjustments,
})

const a = tour("a", "bk_a", { thumbnail: "https://cdn/a.webp" })
const b = tour("b", "bk_b")
const byBookable = new Map([
  ["bk_a", a],
  ["bk_b", b],
])
// Kuruş: 1.500 TL for a's adult, 900 TL for b's; the infants free
const bases = new Map<string, Kurus | null>([
  ["a_adult", 150000 as Kurus],
  ["a_infant", 0 as Kurus],
  ["b_adult", 90000 as Kurus],
  ["b_infant", 0 as Kurus],
])

describe("upcoming departures' rows (adr/0077 §10)", () => {
  it("lists by date, prices each departure on the server in lira, says places only when few", () => {
    const rows = upcomingRows(
      [
        slot("s_a2", "bk_a", "2027-01-20T06:00:00Z", 12, { a_adult: -20000 }),
        slot("s_b1", "bk_b", "2027-01-10T06:00:00Z", FEW_LEFT),
        slot("s_a1", "bk_a", "2027-01-05T06:00:00Z", 2, { a_adult: 25050 }),
      ],
      byBookable,
      bases,
      6,
      NONE
    )

    expect(rows).toEqual([
      {
        product: { id: "a", handle: "tur-a", title: "Tur a", thumbnail: "https://cdn/a.webp" },
        slot_id: "s_a1",
        starts_at: "2027-01-05T06:00:00.000Z",
        timezone: "Europe/Istanbul",
        left: 2,
        from_price: 1750.5,
      },
      expect.objectContaining({ slot_id: "s_b1", left: FEW_LEFT, from_price: 900 }),
      expect.objectContaining({ slot_id: "s_a2", left: null, from_price: 1300 }),
    ])
  })

  it("keeps the first `limit`, leaves out a slot whose product was not read", () => {
    const rows = upcomingRows(
      [
        slot("s_x", "bk_gone", "2027-01-01T06:00:00Z", 3),
        slot("s_b1", "bk_b", "2027-01-10T06:00:00Z", 9),
        slot("s_a1", "bk_a", "2027-01-05T06:00:00Z", 9),
        slot("s_a2", "bk_a", "2027-01-06T06:00:00Z", 9),
      ],
      byBookable,
      bases,
      2,
      NONE
    )

    expect(rows.map((row) => row.slot_id)).toEqual(["s_a1", "s_a2"])
  })

  it("gives no price where no paying category has one", () => {
    const rows = upcomingRows(
      [slot("s_a1", "bk_a", "2027-01-05T06:00:00Z", 9)],
      byBookable,
      new Map<string, Kurus | null>([["a_adult", null]]),
      3,
      NONE
    )

    expect(rows[0]?.from_price).toBeNull()
  })

  it("looks from a day back to a year on", () => {
    expect(horizon(new Date("2026-11-23T10:00:00Z"))).toEqual({
      ranges: [{ from: "2026-11-22", to: "2027-11-23" }],
    })
  })
})

describe("GET /store/departures' query", () => {
  const parse = (query: Record<string, unknown>) => StoreGetDepartures.safeParse(query)

  it("takes a count of three to twelve and one source at most", () => {
    expect(parse({}).success).toBe(true)
    expect(parse({ limit: "6", category_id: "pcat_01KTUR" }).data).toEqual({
      limit: 6,
      category_id: "pcat_01KTUR",
    })
    expect(parse({ kategori: "kultur-turlari" }).success).toBe(true)
    expect(parse({ collection_id: "pcol_01KYAZ" }).success).toBe(true)
    expect(parse({ limit: "2" }).success).toBe(false)
    expect(parse({ limit: "13" }).success).toBe(false)
    expect(parse({ category_id: "pcat_a", collection_id: "pcol_b" }).success).toBe(false)
  })

  it("refuses a price, an unknown field, a malformed id or handle", () => {
    expect(parse({ from_price: "1" }).success).toBe(false)
    expect(parse({ category_id: "DROP TABLE" }).success).toBe(false)
    expect(parse({ kategori: "Yok Boyle" }).success).toBe(false)
  })
})
