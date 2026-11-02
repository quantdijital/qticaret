import type { SearchDoc } from "../../lib/search"
import { LISTING_PARAMS } from "../../lib/seo/facets"
import type { ListingQuery } from "../../lib/seo/facets"

/**
 * Filtering, sorting and counting a listing's products in memory (F18 D4).
 * Pure: the rows are read once, every answer is worked out from them.
 * A filter's own values are counted without itself (the other filters
 * and the price still apply), so choosing a second value of one filter
 * shows what it adds, as shoppers expect.
 */

export interface ListingRow {
  id: string
  /** Milliseconds, for "newest". */
  created_at: number
  brand: { handle: string; name: string } | null
  /** Option values by attribute key. */
  options: Map<string, string[]>
  /** The lowest variant price now, whole currency units with decimals; null when unpriced. */
  price: number | null
  /** What site search reads of it; only the whole catalogue's rows (`all`) carry it. */
  doc?: SearchDoc
}

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
}

export interface FilterDefinition {
  label: string
  /** Option value → label. */
  options: Map<string, string>
}

type Filter = ListingQuery["filters"][number]

function passes(row: ListingRow, [key, values]: Filter): boolean {
  if (key === LISTING_PARAMS.brand) {
    return row.brand !== null && values.includes(row.brand.handle)
  }
  const own = row.options.get(key) ?? []
  return own.some((value) => values.includes(value))
}

function inPrice(row: ListingRow, price: ListingQuery["price"]): boolean {
  if (!price) {
    return true
  }
  if (row.price === null) {
    return false
  }
  return (
    (price.min === null || row.price >= price.min) && (price.max === null || row.price <= price.max)
  )
}

const kept = (rows: ListingRow[], filters: Filter[], price: ListingQuery["price"]) =>
  rows.filter((row) => inPrice(row, price) && filters.every((filter) => passes(row, filter)))

/** The rows the query shows, in its order: newest, cheapest, dearest, or the listing's own. */
export function arrange(rows: ListingRow[], query: ListingQuery): ListingRow[] {
  const shown = kept(rows, query.filters, query.price)
  const unpricedLast = (value: number | null, up: boolean) =>
    value === null ? Number.POSITIVE_INFINITY : up ? value : -value
  switch (query.sort) {
    case "yeni":
      return [...shown].sort((a, b) => b.created_at - a.created_at)
    case "fiyat-artan":
      return [...shown].sort((a, b) => unpricedLast(a.price, true) - unpricedLast(b.price, true))
    case "fiyat-azalan":
      return [...shown].sort((a, b) => unpricedLast(a.price, false) - unpricedLast(b.price, false))
    case null:
      return shown
  }
}

const selectedOf = (query: ListingQuery, key: string) =>
  new Set(query.filters.find(([each]) => each === key)?.[1] ?? [])

const without = (query: ListingQuery, key: string) => query.filters.filter(([each]) => each !== key)

const byCount = (a: FacetValue, b: FacetValue) =>
  b.count - a.count || a.label.localeCompare(b.label, "tr")

export function facetsOf(
  rows: ListingRow[],
  query: ListingQuery,
  definitions: Map<string, FilterDefinition>
): ListingFacets {
  // Brands: counted under every other filter
  const brandRows = kept(rows, without(query, LISTING_PARAMS.brand), query.price)
  const brandSelected = selectedOf(query, LISTING_PARAMS.brand)
  const brands = new Map<string, FacetValue>()
  for (const row of brandRows) {
    if (!row.brand) {
      continue
    }
    const entry = brands.get(row.brand.handle) ?? {
      value: row.brand.handle,
      label: row.brand.name,
      count: 0,
      selected: brandSelected.has(row.brand.handle),
    }
    entry.count += 1
    brands.set(row.brand.handle, entry)
  }

  const attributes: ListingFacets["attributes"] = []
  for (const [key, definition] of definitions) {
    const scoped = kept(rows, without(query, key), query.price)
    const selected = selectedOf(query, key)
    const counts = new Map<string, number>()
    for (const row of scoped) {
      for (const value of row.options.get(key) ?? []) {
        counts.set(value, (counts.get(value) ?? 0) + 1)
      }
    }
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

  const priced = kept(rows, query.filters, null).flatMap((row) =>
    row.price === null ? [] : [row.price]
  )
  return {
    brands: [...brands.values()].sort(byCount),
    attributes,
    price: priced.length
      ? { min: Math.floor(Math.min(...priced)), max: Math.ceil(Math.max(...priced)) }
      : null,
  }
}
