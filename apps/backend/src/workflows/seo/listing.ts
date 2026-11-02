import type { MedusaContainer } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import { chunksOf } from "../../lib/catalog"
import {
  LISTING_PAGE_SIZE,
  LISTING_PARAMS,
  filterKeysOf,
  isNarrowed,
  listingSearch,
  readListingQuery,
  singleFilter,
} from "../../lib/seo/facets"
import type { ListingQuery } from "../../lib/seo/facets"
import { encodePath } from "../../lib/seo/redirects"
import type { RequestPath } from "../../lib/seo/redirects"
import { BRANDS_MODULE } from "../../modules/brands"
import type BrandsModuleService from "../../modules/brands/service"
import { CONTENT_MODULE } from "../../modules/content"
import type ContentModuleService from "../../modules/content/service"
import { PRODUCT_ATTRIBUTES_MODULE } from "../../modules/product-attributes"
import type ProductAttributesModuleService from "../../modules/product-attributes/service"
import { SEO_REDIRECTS_MODULE } from "../../modules/seo-redirects"
import type SeoRedirectsModuleService from "../../modules/seo-redirects/service"
import { CATALOG_ENTITY_TYPES } from "../catalog/entity-paths"
import {
  BRAND_FACET_KEY,
  brandProductIds,
  categoryRows,
  facetProductIds,
  optionProductIds,
  subtreeIn,
} from "../content/landing-facet"
import { SALE_LISTING, saleProductIds } from "../pricing/sale-products"
import { activePathOf } from "./redirects/owners"

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

const LISTING_TYPES: ReadonlySet<string> = new Set([
  CATALOG_ENTITY_TYPES.category,
  CATALOG_ENTITY_TYPES.brand,
  CATALOG_ENTITY_TYPES.collection,
  CATALOG_ENTITY_TYPES.landing,
  SALE_LISTING,
])

export interface Listed {
  entity_type: string
  entity_id: string
}

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

/** The attribute keys a listing's URL may filter by: filterable choice attributes'. */
export function listingFilterKeys(container: MedusaContainer): Promise<Set<string>> {
  return remembered(container, "keys", async () => {
    const definitions = await container
      .resolve<ProductAttributesModuleService>(PRODUCT_ATTRIBUTES_MODULE)
      .listAttributeDefinitions(
        { is_filterable: true, type: ["select", "multi_select"] },
        { select: ["key"] }
      )
    return filterKeysOf(definitions.map((definition) => definition.key))
  })
}

async function brandIdsOf(container: MedusaContainer, handles: string[]): Promise<string[]> {
  const brands = await container
    .resolve<BrandsModuleService>(BRANDS_MODULE)
    .listBrands({ handle: handles, is_active: true }, { select: ["id"] })
  return brands.map((brand) => brand.id)
}

// The products with any of a filter's values; a brand filter names brands by handle
const filterProducts = async (container: MedusaContainer, [key, values]: [string, string[]]) =>
  key === LISTING_PARAMS.brand
    ? brandProductIds(container, await brandIdsOf(container, values))
    : optionProductIds(container, key, values)

/** The products every filter allows, one filter after another; null when nothing filters. */
async function filteredIds(
  container: MedusaContainer,
  filters: ListingQuery["filters"]
): Promise<string[] | null> {
  let kept: string[] | null = null
  for (const filter of filters) {
    const ids = new Set(await filterProducts(container, filter))
    kept = (kept ?? [...ids]).filter((id) => ids.has(id))
    if (kept.length === 0) {
      return kept
    }
  }
  return kept
}

interface Base {
  /** Product filters: a category's shown subtree, a collection. */
  where: Record<string, unknown>
  /** The listing's own products when they are a set of ids (a brand's, a landing page's facet). */
  ids: string[] | null
}

const subtreeWhere = async (container: MedusaContainer, categoryId: string) => ({
  categories: { id: subtreeIn(await categoryRows(container), categoryId, true) },
})

// What the listing lists before its filters; null for a listing gone since
export async function baseOf(container: MedusaContainer, listed: Listed): Promise<Base | null> {
  if (listed.entity_type === CATALOG_ENTITY_TYPES.category) {
    return { where: await subtreeWhere(container, listed.entity_id), ids: null }
  }
  if (listed.entity_type === CATALOG_ENTITY_TYPES.collection) {
    return { where: { collection_id: listed.entity_id }, ids: null }
  }
  if (listed.entity_type === CATALOG_ENTITY_TYPES.brand) {
    return { where: {}, ids: await brandProductIds(container, [listed.entity_id]) }
  }
  if (listed.entity_type === SALE_LISTING) {
    return { where: {}, ids: await saleProductIds(container) }
  }
  const [landing] = await container
    .resolve<ContentModuleService>(CONTENT_MODULE)
    .listLandingPages(
      { id: listed.entity_id },
      { select: ["category_id", "facet_kind", "facet_key", "facet_value"], take: 1 }
    )
  if (!landing) {
    return null
  }
  const facet = { kind: landing.facet_kind, key: landing.facet_key, value: landing.facet_value }
  return {
    where: await subtreeWhere(container, landing.category_id),
    ids: await facetProductIds(container, facet),
  }
}

const intersect = (a: string[] | null, b: string[] | null): string[] | null => {
  if (a === null || b === null) {
    return a ?? b
  }
  const kept = new Set(b)
  return a.filter((id) => kept.has(id))
}

/** How many published products the listing shows with its filters (price aside). */
async function countListing(
  container: MedusaContainer,
  listed: Listed,
  filters: ListingQuery["filters"]
): Promise<number> {
  const filtered = await filteredIds(container, filters)
  const base = filtered?.length === 0 ? null : await baseOf(container, listed)
  const ids = base ? intersect(base.ids, filtered) : []
  if (!base || ids?.length === 0) {
    return 0
  }
  const products = container.resolve(Modules.PRODUCT)
  const where = { ...base.where, status: "published" as const }
  if (ids === null) {
    return (await products.listAndCountProducts(where, { select: ["id"], take: 1 }))[1]
  }
  let count = 0
  for (const chunk of chunksOf(ids)) {
    count += (await products.listAndCountProducts({ ...where, id: chunk }, { take: 1 }))[1]
  }
  return count
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
const hasListingParams = (request: RequestPath, keys: ReadonlySet<string>): boolean =>
  [...request.query.keys()].some(
    (key) => keys.has(key) || Object.values<string>(LISTING_PARAMS).includes(key)
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
  const read = readListingQuery(request.query, keys)
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
