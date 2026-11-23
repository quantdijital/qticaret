import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { createTtlCache } from "../../lib/cache"
import type { Kurus } from "../../lib/money"
import { SEARCH_INDEX_MODULE } from "../../modules/search-index"
import type SearchIndexModuleService from "../../modules/search-index/service"
import { IDS_ONLY_LIMIT } from "../../modules/search-index/types"
import type { CalendarRow } from "../../modules/booking/service"
import { categorySubtreeByHandle, priceKey } from "../seo/listing-plan"
import { basePrices, lira, payingPricesAt, payingVariants } from "./card-facts"
import type { DatedCardProduct } from "./card-facts"
import { bookingService } from "./cart/target"

/**
 * A month's departure calendar (adr/0077 §6): for each local day the
 * departures a date search would match (§3: open, sales still on, room
 * for the party) and the lowest paying price over them, the card's rule
 * (a guest's base price plus each departure's difference, lira only).
 * The products looked at are those the search index lists for the
 * shopper: published, in their sales channels, in the category's shown
 * subtree when one is asked, at most IDS_ONLY_LIMIT; of them only those
 * still sold by departure. Kept a minute in this process.
 */

export interface CalendarInput {
  /** `YYYY-MM`, already checked against the months a search reads. */
  month: string
  /** A category's handle, its shown subtree included; null: every product. */
  category: string | null
  pax: number
  sales_channel_ids: readonly string[]
}

export interface CalendarDay {
  /** `YYYY-MM-DD` in the product's zone. */
  date: string
  /** Lira as the card's `from_price` (1750.5); null when no departure that day has a price. */
  from_price: number | null
  departures: number
}

export interface DepartureCalendar {
  month: string
  currency: "try"
  days: CalendarDay[]
}

/** The calendar's only currency (adr/0077 §6): differences are kept in kuruş. */
const CURRENCY = "try"

const calendarCache = createTtlCache<DepartureCalendar>({ ttlMs: 60_000, maxEntries: 500 })

/** Products the departures matched that the shopper's listing shows, at most IDS_ONLY_LIMIT. */
async function shownProducts(
  container: MedusaContainer,
  input: CalendarInput,
  category: string[] | null,
  matched: string[]
): Promise<string[]> {
  if (matched.length === 0) {
    return []
  }
  const result = await container.resolve<SearchIndexModuleService>(SEARCH_INDEX_MODULE).listing({
    channels: [...input.sales_channel_ids],
    scope: { product_ids: matched, ...(category ? { category_ids: category } : {}) },
    text: null,
    filters: { brands: null, options: [], in_stock: false },
    price: { key: priceKey(null, CURRENCY), min: null, max: null },
    sort: "newest",
    page: { offset: 0, limit: IDS_ONLY_LIMIT },
    idsOnly: true,
  })
  return result.ids
}

/** The days of the rows, each day's departures added up and its lowest price kept. */
export function calendarDays(
  rows: readonly CalendarRow[],
  products: ReadonlyMap<string, DatedCardProduct>,
  bases: ReadonlyMap<string, Kurus | null>
): CalendarDay[] {
  const days = new Map<string, { departures: number; lowest: number | null }>()
  for (const row of rows) {
    const product = products.get(row.bookable_id)
    if (!product) {
      continue
    }
    const prices = row.adjustments.flatMap((adjustments) =>
      payingPricesAt(product, bases, adjustments, CURRENCY)
    )
    const own = prices.length > 0 ? Math.min(...prices) : null
    const day = days.get(row.day) ?? { departures: 0, lowest: null }
    day.departures += row.departures
    if (own !== null && (day.lowest === null || own < day.lowest)) {
      day.lowest = own
    }
    days.set(row.day, day)
  }
  return [...days.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([date, day]) => ({
      date,
      from_price: day.lowest === null ? null : lira(day.lowest as Kurus),
      departures: day.departures,
    }))
}

async function readCalendar(
  container: MedusaContainer,
  input: CalendarInput,
  category: string[] | null,
  now: Date
): Promise<DepartureCalendar> {
  const service = bookingService(container)
  const dates = { months: [input.month] }
  const matches = await service.departureMatches({ dates, pax: input.pax, now })
  const shown = await shownProducts(
    container,
    input,
    category,
    matches.map((match) => match.product_id)
  )
  const empty = emptyCalendar(input.month)
  if (shown.length === 0) {
    return empty
  }
  const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "product",
    fields: [
      "id",
      "variants.id",
      "product_extension.booking_mode",
      "bookable.id",
      "bookable.cutoff_hours",
      "bookable.pax_by_variant",
      "bookable.timezone",
    ],
    // The index lists published products only; read again here as a second guard
    filters: { id: shown, status: "published" },
  })
  // Settings kept from an earlier mode are not a departure
  const byBookable = new Map<string, DatedCardProduct>()
  for (const product of data as DatedCardProduct[]) {
    if (product.bookable && product.product_extension?.booking_mode === "departure") {
      byBookable.set(product.bookable.id, product)
    }
  }
  if (byBookable.size === 0) {
    return empty
  }
  const products = [...byBookable.values()]
  const [bases, rows] = await Promise.all([
    basePrices(container, products.flatMap(payingVariants), { currency_code: CURRENCY }),
    service.calendarRows([...byBookable.keys()], { month: input.month, pax: input.pax, now }),
  ])
  return { ...empty, days: calendarDays(rows, byBookable, bases) }
}

const emptyCalendar = (month: string): DepartureCalendar => ({
  month,
  currency: CURRENCY,
  days: [],
})

/**
 * The month's calendar for the shopper's channels, kept a minute per
 * month, category subtree (its ids, not the handle asked), party and
 * channels. A handle no shown category has answers empty at once: no
 * departure is read and nothing is kept for it, so made-up handles fill
 * no cache.
 */
export async function departureCalendar(
  container: MedusaContainer,
  input: CalendarInput,
  now: Date = new Date()
): Promise<DepartureCalendar> {
  const category = input.category ? await categorySubtreeByHandle(container, input.category) : null
  if (category?.length === 0) {
    return emptyCalendar(input.month)
  }
  const key = JSON.stringify([
    input.month,
    category ? [...category].sort() : null,
    input.pax,
    [...input.sales_channel_ids].sort(),
  ])
  return calendarCache(key, () => readCalendar(container, input, category, now))
}
