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
function fakeContainer(count: number) {
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
      return Promise.resolve({ data: [{ id: "reg_1", currency_code: "try" }] })
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
  const container = {
    resolve: (key: string) => (key === "query" ? { graph } : { windowSlots }),
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

    expect([...one.reads].sort()).toEqual(["product", "product_variant", "region", "slots"])
    expect([...many.reads].sort()).toEqual([...one.reads].sort())
  })

  it("leaves a listing without dates on the index's price, reading nothing", () => {
    const { container, reads } = fakeContainer(2)

    expect(listingDatedPrices(container, query(), null, "reg_1", NOW)).toBeUndefined()
    expect(
      listingDatedPrices(container, query({ sort: "fiyat-artan" }), null, "reg_1", NOW)
    ).toBeUndefined()
    expect(reads).toEqual([])
  })

  it("prices a dated listing's products by the query's dates and party", async () => {
    const { container, windowSlots } = fakeContainer(2)
    const asked = query({
      dates: { kind: "months", months: ["2026-12"] },
      pax: 3,
      sort: "fiyat-azalan",
    })

    const prices = await listingDatedPrices(container, asked, ["prod_0", "prod_1"], "reg_1", NOW)

    expect(prices).toEqual({ prod_0: 3500, prod_1: 900 })
    expect(windowSlots).toHaveBeenCalledWith(
      ["bkbl_0", "bkbl_1"],
      expect.objectContaining({ dates: { months: ["2026-12"] }, pax: 3 }),
      expect.any(Number)
    )
  })
})
