import { createTtlCache } from "../../lib/cache"
import { buildSearchIndex, relatedTerms, searchIndex, suggest } from "../../lib/search"
import type { RelatedTerms, SearchDoc, SearchIndex } from "../../lib/search"
import type { ListingRow } from "./listing-facets"

/**
 * Site search as a listing (`/arama`, docs/20, adr/0046 ek 2026-11-03):
 * the whole catalogue's rows the listing engine already holds (`all`, at
 * most LISTING_SCAN_LIMIT, 30 seconds), weighed against the query in
 * memory with typo tolerance. No search service and no database extension
 * until Meilisearch (D10). The index is built once per rows load; a
 * query's hits are kept with it, by the query as compared, for as long.
 */

/** The listing type of a search; its id is the query as compared. */
export const SEARCH_LISTING = "search"

/** What the answer adds for a search. */
export interface ListingSearch {
  /** "Did you mean": up to five phrases, when a word of the query only matched as a typo. */
  suggestions: string[]
  /** Chips: the categories and brands most hits are in. */
  related: RelatedTerms
  took_ms: number
}

/** Product fields search reads, besides those filtering and sorting do. */
export const SEARCH_FIELDS = [
  "title",
  "subtitle",
  "description",
  "brand.id",
  "categories.id",
  "categories.name",
  "categories.is_active",
  "categories.is_internal",
  "attribute_values.definition.is_public",
]

export interface SearchedProduct {
  id: string
  title?: string | null
  subtitle?: string | null
  description?: string | null
  brand?: { id?: string; handle: string; name: string } | null
  categories?:
    | ({
        id: string
        name: string
        is_active?: boolean | null
        is_internal?: boolean | null
      } | null)[]
    | null
  attribute_values?:
    | ({
        value_text?: string | null
        value_options?: string[] | null
        definition?: { is_public?: boolean | null } | null
      } | null)[]
    | null
}

/**
 * A product as search reads it: its shown categories only, its public
 * attributes' values only (an attribute the shop keeps to itself finds
 * nothing, T5).
 */
export function searchDocOf(product: SearchedProduct): SearchDoc {
  const categories = (product.categories ?? []).flatMap((category) =>
    category?.is_active === true && category.is_internal !== true
      ? [{ id: category.id, name: category.name }]
      : []
  )
  const attributes = (product.attribute_values ?? []).flatMap((value) =>
    value?.definition?.is_public === true
      ? [...(value.value_text ? [value.value_text] : []), ...(value.value_options ?? [])]
      : []
  )
  const brand = product.brand
  return {
    id: product.id,
    title: product.title ?? "",
    subtitle: product.subtitle ?? null,
    description: product.description ?? null,
    brand: brand?.id ? { id: brand.id, name: brand.name, handle: brand.handle } : null,
    categories,
    attributes,
  }
}

interface Searched {
  /** Hit ids, the best first. */
  ids: string[]
  suggestions: string[]
  related: RelatedTerms
}

interface Loaded {
  index: SearchIndex
  rows: ReadonlyMap<string, ListingRow>
  outcomes: (key: string, load: () => Promise<Searched>) => Promise<Searched>
}

/** Queries kept per rows load: the common ones; a stream of new ones pushes out the oldest. */
export const SEARCH_CACHE_ENTRIES = 300

// Dropped with its rows when the listing cache lets them go
const loads = new WeakMap<readonly ListingRow[], Loaded>()

function loadedOf(rows: readonly ListingRow[]): Loaded {
  let loaded = loads.get(rows)
  if (!loaded) {
    loaded = {
      index: buildSearchIndex(rows.flatMap((row) => (row.doc ? [row.doc] : []))),
      rows: new Map(rows.map((row) => [row.id, row])),
      outcomes: createTtlCache<Searched>({ ttlMs: 30_000, maxEntries: SEARCH_CACHE_ENTRIES }),
    }
    loads.set(rows, loaded)
  }
  return loaded
}

/**
 * The rows the query finds, the most relevant first, with its suggestions
 * and related chips. `query` is the query as compared (normalizeText).
 */
export async function searchListingRows(
  rows: readonly ListingRow[],
  query: string
): Promise<{ rows: ListingRow[]; suggestions: string[]; related: RelatedTerms }> {
  const loaded = loadedOf(rows)
  const found = await loaded.outcomes(query, () => {
    const hits = searchIndex(loaded.index, query)
    return Promise.resolve({
      ids: hits.map((hit) => hit.id),
      suggestions: suggest(query, loaded.index),
      related: relatedTerms(hits, loaded.index),
    })
  })
  return {
    rows: found.ids.flatMap((id) => {
      const row = loaded.rows.get(id)
      return row ? [row] : []
    }),
    suggestions: found.suggestions,
    related: found.related,
  }
}
