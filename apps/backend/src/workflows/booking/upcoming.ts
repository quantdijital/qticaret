import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { createTtlCache } from "../../lib/cache"
import type { Kurus } from "../../lib/money"
import { DEPARTURES_LIMITS } from "../../lib/storefront/sections/departures"
import type {
  DepartureMatch,
  DepartureQuery,
  SlotAvailability,
} from "../../modules/booking/service"
import { SEARCH_INDEX_MODULE } from "../../modules/search-index"
import type SearchIndexModuleService from "../../modules/search-index/service"
import { IDS_ONLY_LIMIT } from "../../modules/search-index/types"
import type { ListingPlan } from "../../modules/search-index/types"
import { categoryRows, subtreeIn } from "../content/landing-facet"
import type { CategoryRow } from "../content/landing-facet"
import { categorySubtreeByHandle, priceKey } from "../seo/listing-plan"
import { payingUnitAt, payingVariants } from "./card-facts"
import type { DatedCardProduct } from "./card-facts"
import { baseAmounts, basePriceRows, lira, placeDisplays, shownOf, struck } from "./card-price"
import type { CardShown } from "./card-price"
import { bookingService } from "./cart/target"

/**
 * Upcoming departures (adr/0077 §10, the `departures` section): the
 * nearest departures a shopper could book now (open, sales still on, a
 * place free; adr/0077 §3 for one place) of the products the search index
 * lists for them (published, in their sales channels, in a category's
 * shown subtree or a collection when asked), by date, at most
 * `PER_PRODUCT` each. Each priced on the server by the card's rule (a
 * guest's base price plus the departure's difference, paying places only,
 * lira, the automatic promotions taken off: a promotion changed shows once
 * the kept answer is gone). Places left are told only when few. Kept 30
 * seconds in this process:
 * the matches once for every source and channel, the answer per source and
 * channels at the largest count (a smaller count is its first rows), the
 * category tree a minute.
 */

/** A product's departures in one list at most (`DEPARTURES_LIMITS.per_product`). */
export const PER_PRODUCT = 2
/** "Son N yer" from this many places free, the card's rule (`FEW_PLACES_LEFT`). */
export const FEW_LEFT = 5
/** How far ahead a departure is looked for. */
const HORIZON_DAYS = 365
const DAY = 24 * 60 * 60 * 1000
const CURRENCY = "try"

export type UpcomingScope =
  | { kind: "all" }
  | { kind: "category"; id: string }
  | { kind: "category_handle"; handle: string }
  | { kind: "collection"; id: string }

export interface UpcomingInput {
  limit: number
  scope: UpcomingScope
  sales_channel_ids: readonly string[]
}

export interface UpcomingDeparture {
  product: { id: string; handle: string; title: string; thumbnail: string | null }
  slot_id: string
  starts_at: string
  timezone: string
  left: number | null
  /** Lira, the automatic promotions taken off (adr/0076 Ek "kalkış fiyatı promosyonlu"); null without a price. */
  from_price: number | null
  /** The card's `before`: only when the price-before rule allows, never with a difference; absent otherwise. */
  before?: number
}

export interface UpcomingDepartures {
  currency: "try"
  departures: UpcomingDeparture[]
}

/** A dated product as the list reads it: the card's fields and its name. */
export interface UpcomingProduct extends DatedCardProduct {
  handle: string
  title: string
  thumbnail: string | null
  sales_channels?: ({ id: string } | null)[] | null
}

/** The answer is read for the largest count and cut to the one asked. */
const MOST = DEPARTURES_LIMITS.limit.max

const upcomingCache = createTtlCache<UpcomingDepartures>({ ttlMs: 30_000, maxEntries: 500 })
// The bookable departures do not depend on who asks: one read for every source and channel
const matchesCache = createTtlCache<DepartureMatch[]>({ ttlMs: 30_000, maxEntries: 4 })
// Every category id asked is looked up here, a made-up one too: no table read for each
const categoriesCache = createTtlCache<CategoryRow[]>({ ttlMs: 60_000, maxEntries: 1 })

/** Forgets what is kept (tests that change departures, categories or channels). */
export function clearUpcomingCaches(): void {
  upcomingCache.clear()
  matchesCache.clear()
  categoriesCache.clear()
}

/** Whether the product is in one of the shopper's sales channels. */
export const inChannels = (product: UpcomingProduct, channels: ReadonlySet<string>): boolean =>
  (product.sales_channels ?? []).some((each) => each !== null && channels.has(each.id))

const empty = (): UpcomingDepartures => ({ currency: CURRENCY, departures: [] })

/** From today (a day back, for zones ahead of UTC) to a year on; `now` bounds the start. */
export function horizon(now: Date): DepartureQuery["dates"] {
  const day = (time: number) => new Date(time).toISOString().slice(0, 10)
  return {
    ranges: [{ from: day(now.getTime() - DAY), to: day(now.getTime() + HORIZON_DAYS * DAY) }],
  }
}

/**
 * The rows of the list: the slots by start (then id), the first `limit`,
 * each with its product's name and its lowest paying price as `shown`
 * says (by `placeKey`, the promotions off); a slot whose product is not
 * among those read is left out.
 */
export function upcomingRows(
  slots: readonly SlotAvailability[],
  byBookable: ReadonlyMap<string, UpcomingProduct>,
  bases: ReadonlyMap<string, Kurus | null>,
  limit: number,
  shown: ReadonlyMap<string, CardShown>
): UpcomingDeparture[] {
  return [...slots]
    .flatMap((slot) => {
      const product = byBookable.get(slot.bookable_id)
      return product ? [{ slot, product }] : []
    })
    .sort(
      (a, b) =>
        a.slot.starts_at.getTime() - b.slot.starts_at.getTime() || (a.slot.id < b.slot.id ? -1 : 1)
    )
    .slice(0, limit)
    .map(({ slot, product }) => {
      const unit = payingUnitAt(product, bases, slot.price_adjustments, CURRENCY)
      const price = unit ? shownOf(shown, unit) : null
      return {
        product: {
          id: product.id,
          handle: product.handle,
          title: product.title,
          thumbnail: product.thumbnail ?? null,
        },
        slot_id: slot.id,
        starts_at: slot.starts_at.toISOString(),
        timezone: product.bookable?.timezone ?? "Europe/Istanbul",
        left: slot.available <= FEW_LEFT ? slot.available : null,
        from_price: price === null ? null : lira(price.current),
        ...struck(price),
      }
    })
}

/** A shown category's id and its shown subtree; empty when that category is not shown. */
async function categorySubtreeById(container: MedusaContainer, id: string): Promise<string[]> {
  const rows = await categoriesCache("rows", () => categoryRows(container))
  const root = rows.find((row) => row.id === id)
  if (!root || !root.is_active || root.is_internal) {
    return []
  }
  return subtreeIn(rows, id, true)
}

/** A collection that exists, else null (a made-up id reads nothing and keeps nothing). */
async function collectionOf(container: MedusaContainer, id: string): Promise<string | null> {
  const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "product_collection",
    fields: ["id"],
    filters: { id },
  })
  return (data as { id: string }[])[0]?.id ?? null
}

/** The listing's scope for the source asked; null when it lists nothing. */
async function scopeOf(
  container: MedusaContainer,
  scope: UpcomingScope
): Promise<ListingPlan["scope"] | null> {
  switch (scope.kind) {
    case "all":
      return {}
    case "category":
    case "category_handle": {
      const ids =
        scope.kind === "category"
          ? await categorySubtreeById(container, scope.id)
          : await categorySubtreeByHandle(container, scope.handle)
      return ids.length > 0 ? { category_ids: [...ids].sort() } : null
    }
    case "collection": {
      const id = await collectionOf(container, scope.id)
      return id ? { collection_id: id } : null
    }
  }
}

async function readUpcoming(
  container: MedusaContainer,
  channels: readonly string[],
  scope: ListingPlan["scope"],
  now: Date
): Promise<UpcomingDepartures> {
  const service = bookingService(container)
  const query: DepartureQuery = { dates: horizon(now), pax: 1, now }
  const matches = await matchesCache(JSON.stringify(query.dates), () =>
    service.departureMatches(query)
  )
  if (matches.length === 0) {
    return empty()
  }
  const { ids } = await container.resolve<SearchIndexModuleService>(SEARCH_INDEX_MODULE).listing({
    channels: [...channels],
    scope: { ...scope, product_ids: matches.map((match) => match.product_id) },
    text: null,
    filters: { brands: null, options: [], in_stock: false },
    price: { key: priceKey(null, CURRENCY), min: null, max: null },
    sort: "newest",
    page: { offset: 0, limit: IDS_ONLY_LIMIT },
    idsOnly: true,
  })
  const shown = new Set(ids)
  // The nearest `MOST` products by their first departure hold every row the list can show
  const nearest = matches
    .filter((match) => shown.has(match.product_id))
    .slice(0, MOST)
    .map((match) => match.product_id)
  if (nearest.length === 0) {
    return empty()
  }
  const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "product",
    fields: [
      "id",
      "handle",
      "title",
      "thumbnail",
      "variants.id",
      "variants.variant_rank",
      "product_extension.booking_mode",
      "bookable.id",
      "bookable.cutoff_hours",
      "bookable.pax_by_variant",
      "bookable.timezone",
      "sales_channels.id",
    ],
    // The index lists published products in the shopper's channels only; both read
    // again here as a second guard (an index a moment behind the catalogue)
    filters: { id: nearest, status: "published" },
  })
  const allowed = new Set(channels)
  const byBookable = new Map<string, UpcomingProduct>()
  for (const product of data as UpcomingProduct[]) {
    if (
      product.bookable &&
      product.product_extension?.booking_mode === "departure" &&
      inChannels(product, allowed)
    ) {
      byBookable.set(product.bookable.id, product)
    }
  }
  if (byBookable.size === 0) {
    return empty()
  }
  const products = [...byBookable.values()]
  const [prices, slots] = await Promise.all([
    basePriceRows(container, products.flatMap(payingVariants), { currency_code: CURRENCY }),
    service.windowSlots([...byBookable.keys()], query, PER_PRODUCT),
  ])
  const bases = baseAmounts(prices)
  // Every slot's place in one reading of the record and the promotions
  const units = slots.flatMap((slot) => {
    const product = byBookable.get(slot.bookable_id)
    return (product && payingUnitAt(product, bases, slot.price_adjustments, CURRENCY)) ?? []
  })
  const displays = await placeDisplays(container, units, prices, CURRENCY, now)
  return { currency: CURRENCY, departures: upcomingRows(slots, byBookable, bases, MOST, displays) }
}

/**
 * The upcoming departures for the shopper's channels, kept 30 seconds per
 * source (a category's subtree ids, not the handle asked) and channels,
 * read for the largest count and cut to the count asked: the first `limit`
 * rows of the nearest `MOST` products are those of the nearest `limit`. A
 * category not shown or a collection that does not exist answers empty at
 * once and keeps no answer, so made-up ids fill no answer cache; a category
 * id is looked up in the kept tree.
 */
export async function upcomingDepartures(
  container: MedusaContainer,
  input: UpcomingInput,
  now: Date = new Date()
): Promise<UpcomingDepartures> {
  const scope = await scopeOf(container, input.scope)
  if (scope === null) {
    return empty()
  }
  const channels = [...input.sales_channel_ids].sort()
  const key = JSON.stringify([scope.category_ids ?? null, scope.collection_id ?? null, channels])
  const all = await upcomingCache(key, () => readUpcoming(container, channels, scope, now))
  return { currency: all.currency, departures: all.departures.slice(0, input.limit) }
}
