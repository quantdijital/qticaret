import type { ListingSort, ListingView } from "@qticaret/types"

/**
 * A listing's query (docs/13 §7) as the storefront writes its links: in
 * the backend's canonical form, so a link never costs a 301. `marka`
 * first, then the attribute keys in code-point order, each key's values
 * sorted; then `fiyat`, `sirala`, `sayfa` (no `sayfa=1`, no default sort).
 */
export interface ListingState {
  filters: [string, string[]][]
  price: { min: number | null; max: number | null } | null
  sort: ListingSort | null
  page: number
}

const BRAND = "marka"

const keyOrder = ([a]: [string, string[]], [b]: [string, string[]]) =>
  a === BRAND ? -1 : b === BRAND ? 1 : a < b ? -1 : a > b ? 1 : 0

function normalized(state: ListingState): ListingState {
  return {
    ...state,
    filters: state.filters
      .filter(([, values]) => values.length > 0)
      .map(([key, values]): [string, string[]] => [key, [...new Set(values)].sort()])
      .sort(keyOrder),
  }
}

/** The state the backend read from the page's address; the first page with nothing when plain. */
export function stateOf(listing: ListingView | undefined): ListingState {
  if (!listing) {
    return { filters: [], price: null, sort: null, page: 1 }
  }
  return normalized({
    filters: Object.entries(listing.filters),
    price: listing.price,
    sort: listing.sort,
    page: listing.page,
  })
}

/** The query string, canonical; empty for the plain listing. */
export function searchOf(state: ListingState): string {
  const params = new URLSearchParams()
  for (const [key, values] of state.filters) {
    params.append(key, values.join(","))
  }
  if (state.price) {
    const end = (value: number | null) => (value === null ? "" : String(value))
    params.append("fiyat", `${end(state.price.min)}-${end(state.price.max)}`)
  }
  if (state.sort) {
    params.append("sirala", state.sort)
  }
  if (state.page > 1) {
    params.append("sayfa", String(state.page))
  }
  return params.toString().replace(/%2C/g, ",")
}

export const hrefOf = (pathname: string, state: ListingState): string => {
  const search = searchOf(state)
  return search ? `${pathname}?${search}` : pathname
}

/** A value chosen or let go; any change of the filters starts again at the first page. */
export function toggled(state: ListingState, key: string, value: string): ListingState {
  const current = state.filters.find(([each]) => each === key)?.[1] ?? []
  const next = current.includes(value)
    ? current.filter((each) => each !== value)
    : [...current, value]
  const others = state.filters.filter(([each]) => each !== key)
  return normalized({ ...state, filters: [...others, [key, next]], page: 1 })
}

export const withSort = (state: ListingState, sort: ListingSort | null): ListingState => ({
  ...state,
  sort,
  page: 1,
})

export const withPage = (state: ListingState, page: number): ListingState => ({ ...state, page })

export const withPrice = (state: ListingState, price: ListingState["price"]): ListingState => ({
  ...state,
  price,
  page: 1,
})

/** Every filter and the price range off; the sort stays. */
export const cleared = (state: ListingState): ListingState => ({
  ...state,
  filters: [],
  price: null,
  page: 1,
})

const WHOLE = /^\d{1,9}$/

/**
 * The price form's two fields (`fiyat_en_az`, `fiyat_en_cok`; a plain GET
 * form cannot write `fiyat=min-max`), as the range they ask; undefined
 * when the address holds neither, null for a range that is no range.
 */
export function priceAsked(search: URLSearchParams): ListingState["price"] | undefined {
  const min = search.get("fiyat_en_az")
  const max = search.get("fiyat_en_cok")
  if (min === null && max === null) {
    return undefined
  }
  const read = (value: string | null) => (value && WHOLE.test(value.trim()) ? Number(value) : null)
  const range = { min: read(min), max: read(max) }
  if (range.min === null && range.max === null) {
    return null
  }
  return range.min !== null && range.max !== null && range.min > range.max
    ? { min: range.max, max: range.min }
    : range
}
