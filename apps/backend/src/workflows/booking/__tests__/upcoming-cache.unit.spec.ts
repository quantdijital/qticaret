import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { BOOKING_MODULE } from "../../../modules/booking"
import type { DepartureMatch, SlotAvailability } from "../../../modules/booking/service"
import { PRICE_HISTORY_MODULE } from "../../../modules/price-history"
import { SEARCH_INDEX_MODULE } from "../../../modules/search-index"
import { clearUpcomingCaches, upcomingDepartures } from "../upcoming"

const NOW = new Date("2026-11-23T10:00:00Z")
const day = (n: number) => new Date(NOW.getTime() + n * 24 * 60 * 60 * 1000)

const product = (id: string, channels: string[]) => ({
  id,
  handle: `tur-${id}`,
  title: `Tur ${id}`,
  thumbnail: null,
  variants: [{ id: `${id}_adult` }],
  product_extension: { booking_mode: "departure" },
  bookable: { id: `bk_${id}`, cutoff_hours: 24, pax_by_variant: null, timezone: "UTC" },
  sales_channels: channels.map((channel) => ({ id: channel })),
})

const slot = (id: string, bookable: string, at: Date): SlotAvailability => ({
  id,
  bookable_id: bookable,
  starts_at: at,
  ends_at: null,
  status: "open",
  capacity: 10,
  sold: 0,
  held: 0,
  available: 10,
  price_adjustments: null,
})

/** Four tours a day apart, all listed by the index; `d` in another channel only. */
function shop() {
  const ids = ["a", "b", "c", "d"]
  const matches: DepartureMatch[] = ids.map((id, at) => ({
    product_id: id,
    slot_id: `s_${id}`,
    starts_at: day(at + 2),
    left: 10,
  }))
  const products = ids.map((id) => product(id, id === "d" ? ["sc_other"] : ["sc_web"]))
  const booking = {
    departureMatches: jest.fn(() => Promise.resolve(matches)),
    windowSlots: jest.fn((bookables: string[], _query: unknown, perProduct: number) =>
      Promise.resolve(
        bookables.flatMap((bookable, at) =>
          Array.from({ length: perProduct }, (_, n) =>
            slot(`${bookable}_${String(n)}`, bookable, day(at + 2 + n * 0.5))
          )
        )
      )
    ),
  }
  const listing = jest.fn(() => Promise.resolve({ ids, count: ids.length }))
  const graph = jest.fn(({ entity, filters }: { entity: string; filters?: { id?: unknown } }) => {
    switch (entity) {
      case "product_category":
        return Promise.resolve({ data: [{ id: "pcat_tur", mpath: "pcat_tur", is_active: true }] })
      case "product":
        return Promise.resolve({
          data: products.filter((each) => (filters?.id as string[]).includes(each.id)),
        })
      case "product_variant":
        return Promise.resolve({
          data: (filters?.id as string[]).map((id) => ({
            id,
            calculated_price: { calculated_amount: 1000 },
          })),
        })
      default:
        return Promise.resolve({ data: [] })
    }
  })
  const services: Record<string, unknown> = {
    [BOOKING_MODULE]: booking,
    [SEARCH_INDEX_MODULE]: { listing },
    [ContainerRegistrationKeys.QUERY]: { graph },
    // No price recorded and (the query reads none) no promotion: the card's price as it is
    [PRICE_HISTORY_MODULE]: { historyOf: () => Promise.resolve(new Map()) },
  }
  const container = { resolve: (key: string) => services[key] } as unknown as MedusaContainer
  const reads = (entity: string) =>
    graph.mock.calls.filter(([args]) => args.entity === entity).length
  return { container, booking, listing, reads }
}

const ask = (
  container: MedusaContainer,
  limit: number,
  scope: Parameters<typeof upcomingDepartures>[1]["scope"] = { kind: "all" },
  channels: string[] = ["sc_web"]
) => upcomingDepartures(container, { limit, scope, sales_channel_ids: channels }, NOW)

describe("upcoming departures' caches (adr/0077 §10)", () => {
  beforeEach(() => {
    clearUpcomingCaches()
  })

  it("reads once for every count, cutting the largest answer to the count asked", async () => {
    const { container, booking, listing } = shop()

    const six = await ask(container, 6)
    const three = await ask(container, 3)

    expect(six.departures.map((row) => row.slot_id)).toEqual([
      "bk_a_0",
      "bk_a_1",
      "bk_b_0",
      "bk_b_1",
      "bk_c_0",
      "bk_c_1",
    ])
    expect(three.departures).toEqual(six.departures.slice(0, 3))
    expect(listing).toHaveBeenCalledTimes(1)
    expect(booking.departureMatches).toHaveBeenCalledTimes(1)
    expect(booking.windowSlots).toHaveBeenCalledTimes(1)
  })

  it("reads the departures once for every source and channel set", async () => {
    const { container, booking, listing } = shop()

    await ask(container, 6)
    await ask(container, 6, { kind: "category", id: "pcat_tur" })
    await ask(container, 6, { kind: "all" }, ["sc_web", "sc_app"])

    expect(listing).toHaveBeenCalledTimes(3)
    expect(booking.departureMatches).toHaveBeenCalledTimes(1)
  })

  it("looks every category id up in one kept tree, a made-up one too", async () => {
    const { container, listing, reads } = shop()

    expect((await ask(container, 6, { kind: "category", id: "pcat_yok1" })).departures).toEqual([])
    expect((await ask(container, 6, { kind: "category", id: "pcat_yok2" })).departures).toEqual([])
    await ask(container, 6, { kind: "category", id: "pcat_tur" })

    expect(reads("product_category")).toBe(1)
    expect(listing).toHaveBeenCalledTimes(1)
  })

  it("leaves out a product the index still lists but no longer in the shopper's channels", async () => {
    const { container } = shop()

    const rows = (await ask(container, 12)).departures

    expect(new Set(rows.map((row) => row.product.id))).toEqual(new Set(["a", "b", "c"]))
  })
})
