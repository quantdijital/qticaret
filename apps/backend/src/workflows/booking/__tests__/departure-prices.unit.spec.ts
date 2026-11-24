import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { BOOKING_MODULE } from "../../../modules/booking"
import type {
  CalendarRow,
  DepartureMatch,
  SlotAvailability,
} from "../../../modules/booking/service"
import { PLATFORM_SETTINGS_MODULE } from "../../../modules/platform-settings"
import { PRICE_HISTORY_MODULE } from "../../../modules/price-history"
import { SEARCH_INDEX_MODULE } from "../../../modules/search-index"
import { datedFactsOf } from "../../seo/dated-facts"
import { departureCalendar } from "../calendar"
import { bookingCardFacts } from "../card-facts"
import { storeProductBooking } from "../store-view"
import { clearUpcomingCaches, upcomingDepartures } from "../upcoming"

/**
 * A dated product's departure prices wherever they are shown (adr/0076 Ek
 * "kalkış fiyatı promosyonlu"): the page's departures, the calendar, the
 * upcoming departures and the structured data say the card's price, the
 * automatic promotions taken off by the one display (`placeDisplays`), and
 * strike a price through only on a departure without a difference. The
 * promotion module is a stand-in that applies an automatic promotion to
 * the products it targets; which ones are shown is the real rule.
 */

const NOW = new Date()
const DAY = 24 * 60 * 60 * 1000
const at = (days: number) => new Date(NOW.getTime() + days * DAY)

const TOUR = {
  id: "prod_tour",
  handle: "kapadokya",
  title: "Kapadokya",
  thumbnail: null,
  status: "published",
  variants: [
    { id: "adult", title: "Yetişkin", variant_rank: 0 },
    { id: "child", title: "Çocuk", variant_rank: 1 },
  ],
  sales_channels: [{ id: "sc_web" }],
  product_extension: { booking_mode: "departure" },
  bookable: {
    id: "bk_tour",
    product_id: "prod_tour",
    mode: "departure",
    cutoff_hours: 24,
    hold_minutes: 15,
    max_units_per_cart: 10,
    min_participants: null,
    traveler_fields: null,
    cancellation_tiers: null,
    pax_by_variant: { child: { pax: 1, max_age: 11 } },
    timezone: "Europe/Istanbul",
    reminder_days: 1,
    sale_mode: "online",
  },
}

const slot = (id: string, days: number, adjustments: Record<string, number> | null) =>
  ({
    id,
    bookable_id: "bk_tour",
    starts_at: at(days),
    ends_at: null,
    status: "open",
    capacity: 10,
    sold: 0,
    held: 0,
    available: 10,
    price_adjustments: adjustments,
  }) satisfies SlotAvailability

// One departure at the base prices, one with the adult's place 250,50 TL dearer
const SLOTS = [slot("s1", 3, null), slot("s2", 5, { adult: 25_050 })]
const ROWS: CalendarRow[] = [
  { day: "2027-01-10", bookable_id: "bk_tour", departures: 1, adjustments: [null] },
  { day: "2027-01-12", bookable_id: "bk_tour", departures: 1, adjustments: [{ adult: 25_050 }] },
]
const BASES: Record<string, number> = { adult: 1500, child: 1000 }

const promotion = (code: string, automatic: boolean) => ({
  code,
  type: "standard",
  status: "active",
  is_automatic: automatic,
  is_tax_inclusive: true,
  created_at: at(-2).toISOString(),
  rules: [],
  application_method: {
    type: "percentage",
    target_type: "items",
    allocation: "each",
    value: 20,
    max_quantity: null,
    currency_code: "try",
    buy_rules_min_quantity: null,
  },
  campaign: null,
})
type Promotion = ReturnType<typeof promotion>

interface Line {
  id: string
  unit_price: number | string
  product: { id: string }
}

function shop(promotions: Promotion[]) {
  const computeActions = jest.fn((codes: string[], context: { items: Line[] }) =>
    context.items.flatMap((item) =>
      promotions
        .filter((each) => each.is_automatic || codes.includes(each.code))
        .map((each) => ({
          action: "addItemAdjustment",
          item_id: item.id,
          code: each.code,
          amount: (Number(item.unit_price) * each.application_method.value) / 100,
        }))
    )
  )
  const graph = jest.fn(
    (args: { entity: string; fields: string[]; filters?: { id?: string | string[] } }) => {
      const ids = [args.filters?.id ?? []].flat()
      switch (args.entity) {
        case "promotion":
          // Every row, a code's too: the shown rule, not the read, keeps it out
          return Promise.resolve({ data: promotions })
        case "product":
          return Promise.resolve({ data: [TOUR] })
        case "product_variant":
          return Promise.resolve({
            data: ids.map((id) =>
              args.fields.some((field) => field.startsWith("calculated_price"))
                ? {
                    id,
                    calculated_price: {
                      calculated_amount: BASES[id],
                      original_amount: BASES[id],
                    },
                  }
                : { id, product: { id: "prod_tour", discountable: true } }
            ),
          })
        default:
          return Promise.resolve({ data: [] })
      }
    }
  )
  // Sold at the base prices for weeks: a promotion's discount may be struck through
  const historyOf = jest.fn((ids: readonly string[]) =>
    Promise.resolve(
      new Map(
        ids.map((id) => [
          id,
          [{ recorded_at: at(-20), amount: BASES[id], original_amount: BASES[id] }],
        ])
      )
    )
  )
  const match: DepartureMatch = {
    product_id: "prod_tour",
    slot_id: "s1",
    starts_at: at(3),
    left: 10,
  }
  const services: Record<string, unknown> = {
    [ContainerRegistrationKeys.QUERY]: { graph },
    [Modules.PROMOTION]: { computeActions },
    [PRICE_HISTORY_MODULE]: { historyOf },
    [BOOKING_MODULE]: {
      bookableSlots: () => Promise.resolve(SLOTS),
      openSlots: () => Promise.resolve(SLOTS),
      windowSlots: () => Promise.resolve(SLOTS),
      departureMatches: () => Promise.resolve([match]),
      calendarRows: () => Promise.resolve(ROWS),
    },
    [SEARCH_INDEX_MODULE]: { listing: () => Promise.resolve({ ids: ["prod_tour"], count: 1 }) },
    [PLATFORM_SETTINGS_MODULE]: {
      isFeatureEnabled: () => Promise.resolve(true),
      getSection: () => Promise.resolve({ dated_schema_type: "TouristTrip" }),
    },
  }
  const container = { resolve: (key: string) => services[key] } as unknown as MedusaContainer
  const reads = () => ({
    promotions: graph.mock.calls.filter(([args]) => args.entity === "promotion").length,
    history: historyOf.mock.calls.length,
  })
  return { container, reads, graph, historyOf }
}

// The calendar keeps its answer a minute per channels: a channel of its own each time
let asks = 0

/** Each place's prices for the departures, and the promotions and records read for each. */
async function everyPlace(promotions: Promotion[]) {
  const { container, reads, graph, historyOf } = shop(promotions)
  clearUpcomingCaches()
  const once = async <T>(read: () => Promise<T>) => {
    graph.mockClear()
    historyOf.mockClear()
    const answer = await read()
    return { answer, read: reads() }
  }
  const page = await once(() => storeProductBooking(container, "prod_tour", ["sc_web"]))
  const calendar = await once(() =>
    departureCalendar(
      container,
      { month: "2027-01", category: null, pax: 1, sales_channel_ids: [`sc_${String(++asks)}`] },
      NOW
    )
  )
  const upcoming = await once(() =>
    upcomingDepartures(
      container,
      { limit: 6, scope: { kind: "all" }, sales_channel_ids: ["sc_web"] },
      NOW
    )
  )
  const jsonld = await once(() => datedFactsOf(container, "prod_tour", "departure"))
  const card = (await bookingCardFacts(container, [TOUR], undefined)).get("prod_tour")
  return {
    page: page.answer.slots.map(({ id, prices }) => ({ id, prices })),
    calendar: calendar.answer.days,
    upcoming: upcoming.answer.departures.map(({ slot_id, from_price, ...rest }) => ({
      slot_id,
      from_price,
      ...("before" in rest ? { before: rest.before } : {}),
    })),
    jsonld: jsonld.answer?.departures.map((each) => each.price),
    card: { from_price: card?.from_price, before: card?.before },
    reads: [page.read, calendar.read, upcoming.read, jsonld.read],
  }
}

const PLAIN = {
  page: [
    {
      id: "s1",
      prices: [
        { variant_id: "adult", amount: 1500 },
        { variant_id: "child", amount: 1000 },
      ],
    },
    {
      id: "s2",
      prices: [
        { variant_id: "adult", amount: 1750.5 },
        { variant_id: "child", amount: 1000 },
      ],
    },
  ],
  calendar: [
    { date: "2027-01-10", from_price: 1500, departures: 1 },
    { date: "2027-01-12", from_price: 1750.5, departures: 1 },
  ],
  upcoming: [
    { slot_id: "s1", from_price: 1500 },
    { slot_id: "s2", from_price: 1750.5 },
  ],
  jsonld: [1500, 1750.5],
  card: { from_price: 1500, before: undefined },
}

describe("a dated product's departure prices (adr/0076 Ek kalkış fiyatı promosyonlu)", () => {
  it("without a promotion, says the prices as before, nothing struck through", async () => {
    const shown = await everyPlace([])
    expect({ ...shown, reads: undefined }).toStrictEqual({ ...PLAIN, reads: undefined })
  })

  it("leaves a code's promotion out everywhere: only what every shopper gets", async () => {
    const shown = await everyPlace([promotion("KOD20", false)])
    expect({ ...shown, reads: undefined }).toStrictEqual({ ...PLAIN, reads: undefined })
  })

  it("takes an automatic promotion off every place, as the card does, per category", async () => {
    const shown = await everyPlace([promotion("OTO20", true)])
    expect(shown.page).toStrictEqual([
      {
        id: "s1",
        prices: [
          { variant_id: "adult", amount: 1200, before: 1500 },
          { variant_id: "child", amount: 800, before: 1000 },
        ],
      },
      {
        id: "s2",
        // The adult's difference has no record: its promoted price alone; the child has none
        prices: [
          { variant_id: "adult", amount: 1400.4 },
          { variant_id: "child", amount: 800, before: 1000 },
        ],
      },
    ])
    expect(shown.calendar).toStrictEqual([
      { date: "2027-01-10", from_price: 1200, before: 1500, departures: 1 },
      { date: "2027-01-12", from_price: 1400.4, departures: 1 },
    ])
    expect(shown.upcoming).toStrictEqual([
      { slot_id: "s1", from_price: 1200, before: 1500 },
      { slot_id: "s2", from_price: 1400.4 },
    ])
    // Structured data names the price paid, never one struck through
    expect(shown.jsonld).toStrictEqual([1200, 1400.4])
    // One price: the card's, the page's first departure, the calendar's and the index's
    expect(shown.card).toStrictEqual({ from_price: 1200, before: 1500 })
  })

  it("reads the promotions and the price record once a request, however many departures", async () => {
    const shown = await everyPlace([promotion("OTO20", true)])
    expect(shown.reads).toStrictEqual(
      Array.from({ length: 4 }, () => ({ promotions: 1, history: 1 }))
    )
  })
})
