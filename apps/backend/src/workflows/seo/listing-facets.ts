import { LISTING_PARAMS } from "../../lib/seo/facets"
import type { ListingQuery } from "../../lib/seo/facets"
import type { FacetCount, ListingResult } from "../../modules/search-index/types"

/**
 * A listing's filters as the storefront shows them (F18 D4, adr/0056):
 * the counts come from the search index (a filter's own values counted
 * without itself, the other filters and the price still applying), named
 * and ordered here. Pure.
 */

export interface FacetValue {
  value: string
  label: string
  count: number
  selected: boolean
}

export interface ListingFacets {
  brands: FacetValue[]
  attributes: { key: string; label: string; values: FacetValue[] }[]
  /** The range the listing's prices span under its filters, whole units; null when none is priced. */
  price: { min: number; max: number } | null
  /** `stok=var` (adr/0056): how many it would show, and whether it is chosen. */
  stock: { count: number; selected: boolean }
}

export interface FilterDefinition {
  label: string
  /** Option value → label. */
  options: Map<string, string>
}

const selectedOf = (query: ListingQuery, key: string) =>
  new Set(query.filters.find(([each]) => each === key)?.[1] ?? [])

const byCount = (a: FacetValue, b: FacetValue) =>
  b.count - a.count || a.label.localeCompare(b.label, "tr")

/** A key's counts: its own (filtered: counted without itself) or its share of all. */
function countsOf(result: ListingResult, key: string): Map<string, number> {
  const prefix = `${key}=`
  const own = result.ownOptions[key]
  const counts: FacetCount[] = own ?? result.options
  return new Map(
    counts
      .filter((each) => each.value.startsWith(prefix))
      .map((each) => [each.value.slice(prefix.length), each.count])
  )
}

export function facetsOf(
  result: ListingResult,
  query: ListingQuery,
  definitions: Map<string, FilterDefinition>
): ListingFacets {
  const brandSelected = selectedOf(query, LISTING_PARAMS.brand)
  const brands = result.brands.map((brand) => ({
    value: brand.handle,
    label: brand.name,
    count: brand.count,
    selected: brandSelected.has(brand.handle),
  }))

  const attributes: ListingFacets["attributes"] = []
  for (const [key, definition] of definitions) {
    const counts = countsOf(result, key)
    const selected = selectedOf(query, key)
    const values: FacetValue[] = [...new Set([...counts.keys(), ...selected])].map((value) => ({
      value,
      label: definition.options.get(value) ?? value,
      count: counts.get(value) ?? 0,
      selected: selected.has(value),
    }))
    if (values.length > 0) {
      attributes.push({ key, label: definition.label, values: values.sort(byCount) })
    }
  }

  return {
    brands: brands.sort(byCount),
    attributes,
    price: result.price
      ? { min: Math.floor(result.price.min), max: Math.ceil(result.price.max) }
      : null,
    stock: {
      count: result.inStock,
      selected: query.filters.some(([key]) => key === LISTING_PARAMS.stock),
    },
  }
}
