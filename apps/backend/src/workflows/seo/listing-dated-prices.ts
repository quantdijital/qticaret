import { createHash } from "node:crypto"
import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"
import { createTtlCache } from "../../lib/cache"
import type { ListingQuery } from "../../lib/seo/facets"
import { todayIn } from "../../lib/seo/facets-dated"
import { bookingCardFacts } from "../booking/card-facts"
import type { CardWindow } from "../booking/card-facts"
import { MAX_DATED_PRODUCTS, departureDatesOf } from "./listing-dated"

/**
 * A date search's prices (adr/0077 §5, Ek "tarihli fiyat sırası"): each
 * matched product's lowest price a paying place sells at over the
 * departures inside the dates with room for the party, worked out the way
 * its card's "from" price is (`bookingCardFacts`, one rule for both), so
 * the price sort and the price filter agree with what the card says. A
 * product without such a price has none (sorted last, outside a price
 * filter). Reads are the card's: one product read, one region read, one
 * price read and one slot read, whatever the number of products (at most
 * MAX_DATED_PRODUCTS). Without dates the listing keeps the index's price.
 * Prices are whole currency units with decimals, as the index keeps them.
 */

type Container = Pick<MedusaContainer, "resolve">

const FIELDS = [
  "id",
  "variants.id",
  "product_extension.booking_mode",
  "bookable.id",
  "bookable.cutoff_hours",
  "bookable.pax_by_variant",
  "bookable.timezone",
]

/** The card's currency without a region (card-facts.ts `pricingOf`). */
const NO_REGION_CURRENCY = "try"

/**
 * Kept as long as a date search's products are (listing-dated.ts): places
 * change by the minute. Keyed only by what the server knows (a region it
 * has, dates and party already checked), each loaded once however many
 * ask at once (`createTtlCache`).
 */
const pricesCache = createTtlCache<Record<string, number>>({ ttlMs: 30_000, maxEntries: 200 })

/** The shop's regions and their currencies: a handful, changed rarely. */
const regionsCache = createTtlCache<Map<string, string>>({ ttlMs: 60_000, maxEntries: 1 })

async function regionCurrencies(container: Container): Promise<Map<string, string>> {
  const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "region",
    fields: ["id", "currency_code"],
  })
  return new Map(
    (data as { id: string; currency_code: string }[]).map((region) => [
      region.id,
      region.currency_code.toLowerCase(),
    ])
  )
}

/**
 * The region a date search prices in, checked against the shop's: an
 * unknown region, or a currency other than the region's (the card prices
 * in the region's currency), is refused rather than priced.
 */
export async function datedPricingRegion(
  container: Container,
  regionId: string | null,
  currencyCode: string
): Promise<string | null> {
  const currency = currencyCode.toLowerCase()
  if (regionId === null) {
    if (currency !== NO_REGION_CURRENCY) {
      throw new MedusaError(MedusaError.Types.INVALID_DATA, "listing.currency_mismatch")
    }
    return null
  }
  const regions = await regionsCache("regions", () => regionCurrencies(container))
  const own = regions.get(regionId)
  if (own === undefined) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, "listing.region_unknown")
  }
  if (own !== currency) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, "listing.currency_mismatch")
  }
  return regionId
}

/** The products' prices inside the window, by product id; a product without one is left out. */
export async function datedPricesOf(
  container: Container,
  productIds: readonly string[],
  window: CardWindow,
  regionId: string | null
): Promise<Record<string, number>> {
  const ids = productIds.slice(0, MAX_DATED_PRODUCTS)
  if (ids.length === 0) {
    return {}
  }
  const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "product",
    fields: FIELDS,
    filters: { id: ids },
  })
  const facts = await bookingCardFacts(container, data, regionId ?? undefined, window)
  const prices: Record<string, number> = {}
  for (const [id, fact] of facts) {
    if (fact.from_price !== null) {
      prices[id] = fact.from_price
    }
  }
  return prices
}

/**
 * A listing's prices by product while its query has dates (the products
 * it is narrowed to, `scopeIds`); undefined without dates: the index's.
 */
export async function listingDatedPrices(
  container: Container,
  query: ListingQuery,
  scopeIds: readonly string[] | null,
  pricing: { region_id: string | null; currency_code: string },
  now: Date = new Date()
): Promise<Record<string, number> | undefined> {
  if (!query.dates || !scopeIds) {
    return undefined
  }
  const regionId = await datedPricingRegion(container, pricing.region_id, pricing.currency_code)
  const window: CardWindow = { dates: departureDatesOf(query.dates), pax: query.pax ?? 1 }
  return datedPrices(container, scopeIds, window, regionId, todayIn(now))
}

/** The same, shared a short while by every page, filter and sort of the same search. */
export function datedPrices(
  container: Container,
  productIds: readonly string[],
  window: CardWindow,
  regionId: string | null,
  today: string
): Promise<Record<string, number>> {
  const ids = createHash("sha256").update(productIds.join(",")).digest("hex")
  const key = JSON.stringify([today, window.dates, window.pax, regionId, ids])
  return pricesCache(key, () => datedPricesOf(container, productIds, window, regionId))
}
