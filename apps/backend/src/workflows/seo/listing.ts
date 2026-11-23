import type { MedusaContainer } from "@medusajs/framework/types"
import {
  LISTING_PAGE_SIZE,
  LISTING_PARAMS,
  filterKeysOf,
  isNarrowed,
  isReservedParam,
  listingSearch,
  readListingQuery,
  singleFilter,
} from "../../lib/seo/facets"
import type { ListingQuery, ListingReadOptions } from "../../lib/seo/facets"
import { DATED_PARAMS } from "../../lib/seo/facets-dated"
import { logger } from "../../lib/logging"
import { encodePath } from "../../lib/seo/redirects"
import type { RequestPath } from "../../lib/seo/redirects"
import { BRANDS_MODULE } from "../../modules/brands"
import type BrandsModuleService from "../../modules/brands/service"
import { CONTENT_MODULE } from "../../modules/content"
import type ContentModuleService from "../../modules/content/service"
import { PLATFORM_SETTINGS_MODULE } from "../../modules/platform-settings"
import { CATALOG_BOOKING } from "../../modules/platform-settings/features"
import type PlatformSettingsModuleService from "../../modules/platform-settings/service"
import { PRODUCT_ATTRIBUTES_MODULE } from "../../modules/product-attributes"
import type ProductAttributesModuleService from "../../modules/product-attributes/service"
import { SEO_REDIRECTS_MODULE } from "../../modules/seo-redirects"
import type SeoRedirectsModuleService from "../../modules/seo-redirects/service"
import { CATALOG_ENTITY_TYPES } from "../catalog/entity-paths"
import { BRAND_FACET_KEY } from "../content/landing-facet"
import { SALE_LISTING } from "../pricing/sale-products"
import { countListing } from "./listing-plan"
import type { Listed } from "./listing-plan"
import { activePathOf } from "./redirects/owners"

export type { Listed } from "./listing-plan"

/**
 * A listing page's query answered (docs/13 §3, §7, F3.17): a category,
 * brand, collection, landing page or the sale page with filters, a price range, a sort
 * or a page number. Its own query in canonical order, or a 301 there; a
 * category filtered by one facet that has a live landing page, a 301 to
 * it; filters no product has, or a page past the last, not found. What
 * the database says (keys, the landing page, the count) is kept with the
 * resolve answers, by the canonical listing query: a tracking parameter
 * changes the URL, not the work.
 */

export type ListingAnswer =
  /** No listing parameters, or not a listing: the page as it is. */
  | { kind: "plain" }
  | { kind: "redirect"; location: string }
  | { kind: "not_found" }
  | { kind: "listing"; query: ListingQuery }

/** The records whose page lists products, a page at a time. */
export const LISTING_TYPES: ReadonlySet<string> = new Set([
  CATALOG_ENTITY_TYPES.category,
  CATALOG_ENTITY_TYPES.brand,
  CATALOG_ENTITY_TYPES.collection,
  CATALOG_ENTITY_TYPES.landing,
  SALE_LISTING,
])

/** Kept with the resolve answers until anything changes (at most 30 seconds). */
async function remembered<T>(
  container: MedusaContainer,
  key: string,
  load: () => Promise<T>
): Promise<T> {
  const slot = await container
    .resolve<SeoRedirectsModuleService>(SEO_REDIRECTS_MODULE)
    .resolutionSlot(`listing|${key}`)
  if (slot.value !== undefined) {
    return slot.value as T
  }
  const value = await load()
  slot.keep(value)
  return value
}

// Reserved names a filterable attribute already had, said once a process (adr/0077 §2)
const reservedSaid = new Set<string>()

/**
 * The attribute keys a listing's URL may filter by: filterable choice
 * attributes'. A key a later release reserved (`kategori`, `tarih`,
 * `ay`, `kisi`, adr/0077 §2) is no filter any more; the shop is told in
 * the log, and the attribute keeps its values and its page.
 */
export function listingFilterKeys(container: MedusaContainer): Promise<Set<string>> {
  return remembered(container, "keys", async () => {
    const definitions = await container
      .resolve<ProductAttributesModuleService>(PRODUCT_ATTRIBUTES_MODULE)
      .listAttributeDefinitions(
        { is_filterable: true, type: ["select", "multi_select"] },
        { select: ["key"] }
      )
    const keys = definitions.map((definition) => definition.key)
    for (const key of keys) {
      if (isReservedParam(key) && !reservedSaid.has(key)) {
        reservedSaid.add(key)
        logger.warn({ event: "listing.filter_key_reserved", key })
      }
    }
    return filterKeysOf(keys)
  })
}

/** How the shop reads a listing's query: dates and party only while it sells dated products. */
export async function listingReadOptions(
  container: MedusaContainer,
  search = false
): Promise<ListingReadOptions> {
  const booking = await container
    .resolve<PlatformSettingsModuleService>(PLATFORM_SETTINGS_MODULE)
    .isFeatureEnabled(CATALOG_BOOKING)
  return { booking, search }
}

async function brandIdsOf(container: MedusaContainer, handles: string[]): Promise<string[]> {
  const brands = await container
    .resolve<BrandsModuleService>(BRANDS_MODULE)
    .listBrands({ handle: handles, is_active: true }, { select: ["id"] })
  return brands.map((brand) => brand.id)
}

/** A category's live landing page for this one filter, its path; null when it has none. */
async function landingFor(
  container: MedusaContainer,
  categoryId: string,
  filter: { key: string; value: string }
): Promise<string | null> {
  const isBrand = filter.key === LISTING_PARAMS.brand
  const value = isBrand ? (await brandIdsOf(container, [filter.value]))[0] : filter.value
  if (!value) {
    return null
  }
  const [landing] = await container.resolve<ContentModuleService>(CONTENT_MODULE).listLandingPages(
    {
      category_id: categoryId,
      facet_kind: isBrand ? "brand" : "attribute",
      facet_key: isBrand ? BRAND_FACET_KEY : filter.key,
      facet_value: value,
      status: "published",
    },
    { select: ["id"], take: 1 }
  )
  return landing
    ? activePathOf(container, { entity_type: CATALOG_ENTITY_TYPES.landing, entity_id: landing.id })
    : null
}

const listingLocation = (path: string, query: ListingQuery): string => {
  const search = listingSearch(query)
  return search ? `${encodePath(path)}?${search}` : encodePath(path)
}

/** Whether the query names anything a listing reads; utm and other parameters do not. */
// `kategori` is a search's: on a listing page it is any other parameter
const DATED_KEYS: readonly string[] = [DATED_PARAMS.dates, DATED_PARAMS.months, DATED_PARAMS.pax]

const hasListingParams = (request: RequestPath, keys: ReadonlySet<string>): boolean =>
  [...request.query.keys()].some(
    (key) =>
      keys.has(key) ||
      Object.values<string>(LISTING_PARAMS).includes(key) ||
      DATED_KEYS.includes(key)
  )

/** The facts a canonical listing query needs from the database, remembered. */
const factsOf = (container: MedusaContainer, listed: Listed, query: ListingQuery) =>
  remembered(
    container,
    `${listed.entity_type}|${listed.entity_id}|${listingSearch({ ...query, rest: [] })}`,
    async () => {
      const single = singleFilter(query)
      const landing =
        single && listed.entity_type === CATALOG_ENTITY_TYPES.category
          ? await landingFor(container, listed.entity_id, single)
          : null
      const isCounted = !landing && (query.filters.length > 0 || query.page > 1)
      return {
        landing,
        count: isCounted ? await countListing(container, listed, query.filters) : null,
      }
    }
  )

/**
 * The listing's answer for its query. The page itself was found live at
 * `request.path`; this decides what its query makes of it.
 */
export async function listingAnswer(
  container: MedusaContainer,
  listed: Listed,
  request: RequestPath
): Promise<ListingAnswer> {
  if (!LISTING_TYPES.has(listed.entity_type) || request.query.size === 0) {
    return { kind: "plain" }
  }
  const keys = await listingFilterKeys(container)
  if (!hasListingParams(request, keys)) {
    return { kind: "plain" }
  }
  const read = readListingQuery(request.query, keys, await listingReadOptions(container))
  if (read.kind === "out_of_bounds") {
    return { kind: "not_found" }
  }
  const { query } = read
  const facts = await factsOf(container, listed, query)
  if (facts.landing) {
    return { kind: "redirect", location: listingLocation(facts.landing, { ...query, filters: [] }) }
  }
  if (!read.isCanonical) {
    return { kind: "redirect", location: listingLocation(request.path, query) }
  }
  if (facts.count !== null) {
    const pages = Math.max(1, Math.ceil(facts.count / LISTING_PAGE_SIZE))
    if ((query.filters.length > 0 && facts.count === 0) || query.page > pages) {
      return { kind: "not_found" }
    }
  }
  return isNarrowed(query) || query.page > 1 ? { kind: "listing", query } : { kind: "plain" }
}
