import type { MedusaContainer } from "@medusajs/framework/types"
import { createTtlCache } from "../../lib/cache"
import { LISTING_PAGE_SIZE, LISTING_PARAMS, isReservedParam } from "../../lib/seo/facets"
import type { ListingQuery } from "../../lib/seo/facets"
import { PRODUCT_ATTRIBUTES_MODULE } from "../../modules/product-attributes"
import type ProductAttributesModuleService from "../../modules/product-attributes/service"
import { SEARCH_INDEX_MODULE } from "../../modules/search-index"
import type SearchIndexModuleService from "../../modules/search-index/service"
import type { ListingPlan, ListingResult } from "../../modules/search-index/types"
import { facetsOf } from "./listing-facets"
import type { FilterDefinition, ListingFacets } from "./listing-facets"
import { listingScope, planFilters, planSort, priceKey } from "./listing-plan"
import type { Listed } from "./listing-plan"
import { SEARCH_LISTING, searchListing } from "./listing-search"
import type { ListingSearch } from "./listing-search"

/**
 * A listing page's products for the storefront (F18 D4, docs/13 §7,
 * adr/0056): the listing's published products in the shopper's sales
 * channels, narrowed by its filters and price range, in its sort, one
 * page of ids; and the filters it can offer with how many products each
 * would show. Answered by the search index in one statement, paged in
 * the database: a listing of any size answers whole. A site search
 * (`search`) is the whole catalogue matched against the query, most
 * relevant first (listing-search.ts).
 */

export { ALL_PRODUCTS } from "./listing-plan"

export interface ListingProductsInput {
  listed: Listed
  query: ListingQuery
  /** A site search's words as the shopper typed them. */
  search?: string
  currency_code: string
  region_id: string | null
  sales_channel_ids: readonly string[]
}

export interface ListingProductsAnswer {
  product_ids: string[]
  count: number
  page: number
  page_size: number
  facets: ListingFacets
  /** A site search's suggestions and related chips. */
  search?: ListingSearch
}

/** The filterable choice attributes, by key: their labels and option labels, in rank order. */
async function filterDefinitions(container: MedusaContainer) {
  const definitions = await container
    .resolve<ProductAttributesModuleService>(PRODUCT_ATTRIBUTES_MODULE)
    .listAttributeDefinitions(
      { is_filterable: true, is_public: true, type: ["select", "multi_select"] },
      { select: ["key", "label", "options", "rank"], order: { rank: "ASC" } }
    )
  const byKey = new Map<string, FilterDefinition>()
  for (const definition of definitions) {
    // A key the URL keeps for itself (`marka`, `stok`) is no attribute filter
    if (definition.key === LISTING_PARAMS.brand || isReservedParam(definition.key)) {
      continue
    }
    const entry = byKey.get(definition.key) ?? { label: definition.label, options: new Map() }
    for (const option of (definition.options ?? []) as { value: string; label: string }[]) {
      entry.options.set(option.value, option.label)
    }
    byKey.set(definition.key, entry)
  }
  return byKey
}

// Labels change rarely; every page and filter of every listing shares them for 30 seconds
const definitionsCache = createTtlCache<Map<string, FilterDefinition>>({
  ttlMs: 30_000,
  maxEntries: 1,
})

const NOTHING: ListingResult = {
  count: 0,
  ids: [],
  brands: [],
  options: [],
  ownOptions: {},
  inStock: 0,
  price: null,
  related: null,
}

export async function listingProducts(
  container: MedusaContainer,
  input: ListingProductsInput
): Promise<ListingProductsAnswer> {
  const started = performance.now()
  const isSearch = input.listed.entity_type === SEARCH_LISTING
  const [scope, definitions] = await Promise.all([
    isSearch ? Promise.resolve({}) : listingScope(container, input.listed, input.region_id),
    definitionsCache("definitions", () => filterDefinitions(container)),
  ])
  const { query } = input
  const base: ListingPlan = {
    channels: [...input.sales_channel_ids],
    scope: scope ?? {},
    text: null,
    filters: planFilters(query.filters),
    price: {
      key: priceKey(input.region_id, input.currency_code),
      min: query.price?.min ?? null,
      max: query.price?.max ?? null,
    },
    sort: planSort(query.sort, isSearch),
    page: { offset: (query.page - 1) * LISTING_PAGE_SIZE, limit: LISTING_PAGE_SIZE },
  }
  const index = container.resolve<SearchIndexModuleService>(SEARCH_INDEX_MODULE)
  const searched = isSearch ? await searchListing(container, base, input.search ?? "") : null
  const result = !scope
    ? NOTHING
    : searched
      ? (searched.result ?? NOTHING)
      : await index.listing(base)
  const answer: ListingProductsAnswer = {
    product_ids: result.ids,
    count: result.count,
    page: query.page,
    page_size: LISTING_PAGE_SIZE,
    facets: facetsOf(result, query, definitions),
  }
  if (searched) {
    answer.search = {
      suggestions: searched.suggestions,
      related: searched.related,
      took_ms: Math.round(performance.now() - started),
    }
  }
  return answer
}
