import { createHash } from "node:crypto"
import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { createTtlCache } from "../../lib/cache"
import type { Kurus } from "../../lib/money"
import { SEARCH_INDEX_MODULE } from "../../modules/search-index"
import type SearchIndexModuleService from "../../modules/search-index/service"
import { IDS_ONLY_LIMIT } from "../../modules/search-index/types"
import type { CalendarRow } from "../../modules/booking/service"
import { categorySubtreeByHandle, priceKey } from "../seo/listing-plan"
import { payingUnitAt, payingVariants } from "./card-facts"
import type { DatedCardProduct, PayingUnit } from "./card-facts"
import {
  baseAmounts,
  basePriceRows,
  lira,
  lowestShown,
  placeDisplays,
  placeKey,
  struck,
} from "./card-price"
import type { BasePrice, CardShown } from "./card-price"
import { bookingService } from "./cart/target"

/**
 * A month's departure calendar (adr/0077 §6): for each local day the
 * departures a date search would match (§3: open, sales still on, room
 * for the party) and the lowest paying price over them, the card's rule
 * (a guest's base price plus each departure's difference, lira only, the
 * automatic promotions taken off). A promotion changed shows here once
 * the kept answer is gone.
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
  /**
   * Lira as the card's `from_price` (1750.5), the automatic promotions
   * taken off (adr/0076 Ek "kalkış fiyatı promosyonlu"); null when no
   * departure that day has a price.
   */
  from_price: number | null
  /** The card's `before`: struck through only when the price-before rule allows, never with a difference; absent otherwise. */
  before?: number
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

/**
 * The places as shown, kept as long as the calendar, by the places alone
 * (`placesKey`): a party's size only picks which departures count, never
 * what a place costs, so parties whose days share places share one
 * reading of the record and the promotions (adr/0076 Ek "kalkış fiyatı
 * promosyonlu").
 */
const displayCache = createTtlCache<Map<string, CardShown>>({ ttlMs: 60_000, maxEntries: 500 })

/**
 * Everything a place's display is worked out from (`placeDisplays`): the
 * currency and, per place, its category, difference, price and the price
 * before a sale list; in no order, each place once. Hashed: a month may
 * have many places.
 */
export function placesKey(
  units: readonly PayingUnit[],
  bases: ReadonlyMap<string, BasePrice | null>,
  currency: string
): string {
  const places = new Set(
    units.map((unit) => {
      const base = bases.get(unit.variant_id)
      return JSON.stringify([
        placeKey(unit),
        String(unit.amount),
        base ? [String(base.calculated), String(base.original)] : null,
      ])
    })
  )
  return createHash("sha256")
    .update(JSON.stringify([currency.toLowerCase(), [...places].sort()]))
    .digest("hex")
}

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

/** The places a row's departures sell at before the promotions: one a departure, its main paying category's. */
export function rowUnits(
  row: CalendarRow,
  products: ReadonlyMap<string, DatedCardProduct>,
  bases: ReadonlyMap<string, Kurus | null>
): PayingUnit[] {
  const product = products.get(row.bookable_id)
  return product
    ? row.adjustments.flatMap((adjustments) => {
        const unit = payingUnitAt(product, bases, adjustments, CURRENCY)
        return unit ? [unit] : []
      })
    : []
}

/**
 * The days of the rows, each day's departures added up and its lowest
 * price kept: the card's, its places as shown (`shown`, by `placeKey`:
 * the automatic promotions taken off; adr/0076 Ek "kalkış fiyatı
 * promosyonlu"), a place without a display at its own price.
 */
export function calendarDays(
  rows: readonly CalendarRow[],
  products: ReadonlyMap<string, DatedCardProduct>,
  bases: ReadonlyMap<string, Kurus | null>,
  shown: ReadonlyMap<string, CardShown>
): CalendarDay[] {
  const days = new Map<string, { departures: number; lowest: CardShown | null }>()
  for (const row of rows) {
    if (!products.has(row.bookable_id)) {
      continue
    }
    const own = lowestShown(rowUnits(row, products, bases), shown)
    const day = days.get(row.day) ?? { departures: 0, lowest: null }
    day.departures += row.departures
    if (own !== null && (day.lowest === null || own.current < day.lowest.current)) {
      day.lowest = own
    }
    days.set(row.day, day)
  }
  return [...days.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([date, day]) => ({
      date,
      from_price: day.lowest === null ? null : lira(day.lowest.current),
      ...struck(day.lowest),
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
      "variants.variant_rank",
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
  const [prices, rows] = await Promise.all([
    basePriceRows(container, products.flatMap(payingVariants), { currency_code: CURRENCY }),
    service.calendarRows([...byBookable.keys()], { month: input.month, pax: input.pax, now }),
  ])
  const bases = baseAmounts(prices)
  // Every day's places in one reading of the record and the promotions, whatever the party
  const units = rows.flatMap((row) => rowUnits(row, byBookable, bases))
  const displays = await displayCache(placesKey(units, prices, CURRENCY), () =>
    placeDisplays(container, units, prices, CURRENCY, now)
  )
  return { ...empty, days: calendarDays(rows, byBookable, bases, displays) }
}

const emptyCalendar = (month: string): DepartureCalendar => ({
  month,
  currency: CURRENCY,
  days: [],
})

/**
 * The month's calendar for the shopper's channels, kept a minute per
 * month, category subtree (its ids, not the handle asked), party and
 * channels; its places' promoted prices a minute by the places alone,
 * whatever the party. A handle no shown category has answers empty at once: no
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
