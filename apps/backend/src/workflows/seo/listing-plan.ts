import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { LISTING_PAGE_SIZE, LISTING_PARAMS } from "../../lib/seo/facets"
import type { ListingQuery } from "../../lib/seo/facets"
import { CONTENT_MODULE } from "../../modules/content"
import type ContentModuleService from "../../modules/content/service"
import { SEARCH_INDEX_MODULE } from "../../modules/search-index"
import type SearchIndexModuleService from "../../modules/search-index/service"
import type { ListingPlan } from "../../modules/search-index/types"
import { CATALOG_ENTITY_TYPES } from "../catalog/entity-paths"
import { categoryRows, subtreeIn } from "../content/landing-facet"
import { SALE_LISTING, SALE_SCOPE } from "../pricing/sale-products"

/**
 * What a listing asks of the search index (adr/0056): its scope (a
 * category's shown subtree, a collection, a brand, a landing page's
 * category and facet, what is on sale now, or the whole catalogue), the
 * query's filters, price range, sort and page. What is on sale is a fact
 * of each row, worked out when the product is indexed (price lists and
 * automatic promotions, the price-before rule; sale-products.ts); the
 * category tree is read each time (a shop keeps hundreds at most).
 */

/** The whole catalogue's listing (`/magaza`): every published product. */
export const ALL_PRODUCTS = "all"

export interface Listed {
  entity_type: string
  entity_id: string
}

const subtree = async (container: MedusaContainer, categoryId: string) =>
  subtreeIn(await categoryRows(container), categoryId, true)

/**
 * A search's `kategori` (adr/0077 §2): the shown category with that
 * handle and its shown subtree; an empty list when none is shown by it
 * (the search then lists nothing).
 */
export async function categorySubtreeByHandle(
  container: MedusaContainer,
  handle: string
): Promise<string[]> {
  const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "product_category",
    fields: ["id"],
    filters: { handle, is_active: true, is_internal: false },
  })
  const found = (data as { id: string }[])[0]
  return found ? subtree(container, found.id) : []
}

/** What the listing lists before its filters; null for a listing gone since or none known. */
export async function listingScope(
  container: MedusaContainer,
  listed: Listed
): Promise<ListingPlan["scope"] | null> {
  switch (listed.entity_type) {
    case ALL_PRODUCTS:
      return {}
    case CATALOG_ENTITY_TYPES.category:
      return { category_ids: await subtree(container, listed.entity_id) }
    case CATALOG_ENTITY_TYPES.collection:
      return { collection_id: listed.entity_id }
    case CATALOG_ENTITY_TYPES.brand:
      return { brand_id: listed.entity_id }
    case SALE_LISTING:
      return { ...SALE_SCOPE }
    case CATALOG_ENTITY_TYPES.landing:
      break
    default:
      return null
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
  const category_ids = await subtree(container, landing.category_id)
  return landing.facet_kind === "brand"
    ? { category_ids, brand_id: landing.facet_value }
    : { category_ids, option: `${landing.facet_key}=${landing.facet_value}` }
}

/** The query's filters as the index reads them: brands, options, in stock only. */
export function planFilters(filters: ListingQuery["filters"]): ListingPlan["filters"] {
  const planned: ListingPlan["filters"] = { brands: null, options: [], in_stock: false }
  for (const [key, values] of filters) {
    if (key === LISTING_PARAMS.brand) {
      planned.brands = values
    } else if (key === LISTING_PARAMS.stock) {
      planned.in_stock = true
    } else {
      planned.options.push({ key, values })
    }
  }
  return planned
}

const SORTS: Record<NonNullable<ListingQuery["sort"]>, ListingPlan["sort"]> = {
  yeni: "newest",
  "fiyat-artan": "price_asc",
  "fiyat-azalan": "price_desc",
  // The nearest departure first (adr/0077 §2): the ids come in that order from the booking module
  kalkis: "ids_order",
}

/** The query's sort; none chosen is relevance for a search, the newest first for a listing. */
export const planSort = (sort: ListingQuery["sort"], isSearch: boolean): ListingPlan["sort"] =>
  sort ? SORTS[sort] : isSearch ? "relevance" : "newest"

/** Prices are kept per region and currency (search-index `prices`). */
export const priceKey = (regionId: string | null, currency: string): string =>
  `${regionId ?? ""}:${currency}`

/**
 * How many published products a listing shows with its filters, in any
 * sales channel, its price range aside: what a listing's resolve decides
 * a page past the last, or filters that leave nothing, by (F3.17).
 */
export async function countListing(
  container: MedusaContainer,
  listed: Listed,
  filters: ListingQuery["filters"]
): Promise<number> {
  const scope = await listingScope(container, listed)
  if (!scope) {
    return 0
  }
  const result = await container.resolve<SearchIndexModuleService>(SEARCH_INDEX_MODULE).listing({
    channels: null,
    scope,
    text: null,
    filters: planFilters(filters),
    price: { key: priceKey(null, ""), min: null, max: null },
    sort: "newest",
    page: { offset: 0, limit: LISTING_PAGE_SIZE },
    countOnly: true,
  })
  return result.count
}
