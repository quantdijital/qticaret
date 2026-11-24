import type { ListingQuery } from "../../../lib/seo/facets"
import type { SlotAvailability } from "../../../modules/booking/service"
import { datedPricesOf, listingDatedPrices } from "../listing-dated-prices"

// adr/0077 §5 Ek "tarihli fiyat sırası": a date search sorts and filters by the card's price

const NOW = new Date("2026-12-01T09:00:00.000Z")
const DAY = 24 * 60 * 60 * 1000

const query = (over: Partial<ListingQuery> = {}): ListingQuery => ({
  filters: [],
  price: null,
  sort: null,
  page: 1,
  rest: [],
  ...over,
})

const product = (n: number) => ({
  id: `prod_${String(n)}`,
  variants: [{ id: `adult_${String(n)}` }, { id: `infant_${String(n)}` }],
  product_extension: { booking_mode: "departure" },
  bookable: {
    id: `bkbl_${String(n)}`,
    cutoff_hours: 24,
    pax_by_variant: { [`infant_${String(n)}`]: { pax: 0 } },
    timezone: "Europe/Istanbul",
  },
})

const slot = (
  n: number,
  daysAhead: number,
  price_adjustments: Record<string, number> | null = null
): SlotAvailability => ({
  id: `slot_${String(n)}_${String(daysAhead)}`,
  bookable_id: `bkbl_${String(n)}`,
  starts_at: new Date(Date.now() + daysAhead * DAY),
  ends_at: new Date(Date.now() + (daysAhead + 1) * DAY),
  status: "open",
  capacity: 10,
  sold: 0,
  held: 0,
  available: 10,
  price_adjustments,
})

/** A container whose reads are counted: the products, the region, the prices and the slots. */
function fakeContainer(count: number, regionIds: string[] = ["reg_1"]) {
  const reads: string[] = []
  const products = Array.from({ length: count }, (_, at) => product(at))
  const graph = jest.fn((request: { entity: string; filters: { id: string[] } }) => {
    reads.push(request.entity)
    if (request.entity === "product") {
      return Promise.resolve({
        data: products.filter((each) => request.filters.id.includes(each.id)),
      })
    }
    if (request.entity === "region") {
      return Promise.resolve({ data: regionIds.map((id) => ({ id, currency_code: "try" })) })
    }
    // No automatic promotion: the card's price is its own (card-price.ts)
    if (request.entity === "promotion") {
      return Promise.resolve({ data: [] })
    }
    // Every adult 1.000 TL, an infant free
    return Promise.resolve({
      data: request.filters.id.map((id) => ({
        id,
        calculated_price: { calculated_amount: id.startsWith("adult") ? 1000 : 0 },
      })),
    })
  })
  const windowSlots = jest.fn((bookableIds: string[]) => {
    reads.push("slots")
    // prod_0: its only departure in the dates is 2.500 TL dearer; prod_1: 100 TL off
    return Promise.resolve(
      [slot(0, 10, { adult_0: 250_000 }), slot(1, 12, { adult_1: -10_000 }), slot(1, 14)].filter(
        (each) => bookableIds.includes(each.bookable_id)
      )
    )
  })
  const historyOf = (ids: readonly string[]) => {
    reads.push("history")
    return Promise.resolve(new Map(ids.map((id) => [id, []])))
  }
  const services: Record<string, unknown> = { query: { graph }, priceHistory: { historyOf } }
  const container = {
    resolve: (key: string) => services[key] ?? { windowSlots },
  }
  return { container, reads, graph, windowSlots }
}

const window = { dates: { ranges: [{ from: "2026-12-05", to: "2026-12-20" }] }, pax: 2 }

describe("a date search's prices", () => {
  it("prices each product over its departures inside the dates, as its card does", async () => {
    const { container, windowSlots } = fakeContainer(3)

    const prices = await datedPricesOf(container, ["prod_0", "prod_1", "prod_2"], window, "reg_1")

    // A dear departure makes the cheap base dear; the lowest of a product's departures counts;
    // a product with no departure in the dates has the base price, as its card says
    expect(prices).toEqual({ prod_0: 3500, prod_1: 900, prod_2: 1000 })
    expect(windowSlots).toHaveBeenCalledWith(
      ["bkbl_0", "bkbl_1", "bkbl_2"],
      expect.objectContaining({ dates: window.dates, pax: 2 }),
      expect.any(Number)
    )
  })

  it("reads as many times for a thousand products as for one: no read per product", async () => {
    const one = fakeContainer(1)
    const many = fakeContainer(1000)
    const ids = Array.from({ length: 1000 }, (_, at) => `prod_${String(at)}`)

    await datedPricesOf(one.container, ["prod_0"], window, "reg_1")
    await datedPricesOf(many.container, ids, window, "reg_1")

    // The promotions and the price history once too (card-price.ts), not per part of 100
    expect([...one.reads].sort()).toEqual([
      "history",
      "product",
      "product_variant",
      "promotion",
      "region",
      "slots",
    ])
    expect([...many.reads].sort()).toEqual([...one.reads].sort())
  })

  it("reads at most a date search's products, however many ids it is given", async () => {
    const { container, graph } = fakeContainer(2)
    const ids = Array.from({ length: 1500 }, (_, at) => `prod_${String(at)}`)

    await datedPricesOf(container, ids, window, "reg_1")

    const productRead = graph.mock.calls.find(([request]) => request.entity === "product")
    expect(productRead?.[0].filters.id).toHaveLength(1000)
  })

  it("leaves a listing without dates on the index's price, reading nothing", async () => {
    const { container, reads } = fakeContainer(2)
    const pricing = { region_id: "reg_x", currency_code: "usd" }

    await expect(
      listingDatedPrices(container, query(), null, pricing, NOW)
    ).resolves.toBeUndefined()
    await expect(
      listingDatedPrices(container, query({ sort: "fiyat-artan" }), null, pricing, NOW)
    ).resolves.toBeUndefined()
    expect(reads).toEqual([])
  })

  it("prices a dated listing's products by the query's dates and party", async () => {
    const { container, windowSlots } = fakeContainer(2)
    const asked = query({
      dates: { kind: "months", months: ["2026-12"] },
      pax: 3,
      sort: "fiyat-azalan",
    })

    const prices = await listingDatedPrices(
      container,
      asked,
      ["prod_0", "prod_1"],
      { region_id: "reg_1", currency_code: "try" },
      NOW
    )

    expect(prices).toEqual({ prod_0: 3500, prod_1: 900 })
    expect(windowSlots).toHaveBeenCalledWith(
      ["bkbl_0", "bkbl_1"],
      expect.objectContaining({ dates: { months: ["2026-12"] }, pax: 3 }),
      expect.any(Number)
    )
  })

  it("refuses a region the shop has not, or another currency than its, before any heavy read", async () => {
    const { container, windowSlots } = fakeContainer(2)
    const asked = query({ dates: { kind: "months", months: ["2026-12"] } })
    const ids = ["prod_0", "prod_1"]

    await expect(
      listingDatedPrices(container, asked, ids, { region_id: "reg_made_up", currency_code: "try" })
    ).rejects.toThrow("listing.region_unknown")
    await expect(
      listingDatedPrices(container, asked, ids, { region_id: "reg_1", currency_code: "usd" })
    ).rejects.toThrow("listing.currency_mismatch")
    await expect(
      listingDatedPrices(container, asked, ids, { region_id: null, currency_code: "usd" })
    ).rejects.toThrow("listing.currency_mismatch")
    expect(windowSlots).not.toHaveBeenCalled()
  })

  it("prices in a region added since the shop's regions were kept, not refusing it", async () => {
    const before = fakeContainer(2)
    const after = fakeContainer(2, ["reg_1", "reg_new"])
    const asked = query({ dates: { kind: "months", months: ["2026-12"] } })
    const ids = ["prod_0", "prod_1"]

    await listingDatedPrices(before.container, asked, ids, {
      region_id: "reg_1",
      currency_code: "try",
    })
    const prices = await listingDatedPrices(after.container, asked, ids, {
      region_id: "reg_new",
      currency_code: "try",
    })

    expect(prices).toEqual({ prod_0: 3500, prod_1: 900 })
  })

  it("works a search's prices out once however many ask at once", async () => {
    const { container, windowSlots } = fakeContainer(2)
    // Dates no other test here asks: the prices are kept a while per search
    const asked = query({ dates: { kind: "range", from: "2026-12-21", to: "2026-12-28" } })
    const pricing = { region_id: "reg_1", currency_code: "TRY" }

    const [first, second] = await Promise.all([
      listingDatedPrices(container, asked, ["prod_0", "prod_1"], pricing, NOW),
      listingDatedPrices(container, asked, ["prod_0", "prod_1"], pricing, NOW),
    ])

    expect(second).toEqual(first)
    expect(windowSlots).toHaveBeenCalledTimes(1)
  })
})
