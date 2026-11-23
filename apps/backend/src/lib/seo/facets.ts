/**
 * A listing page's query (docs/13 §3, §7, F3.17): its filters, price
 * range, sort and page, in one canonical form. Filters are parameters
 * named after what they narrow by: `marka` (brand handles), the keys of
 * filterable attributes (option values), several values comma separated
 * (`renk=kirmizi,mavi`), and `stok=var` (in stock only, adr/0056). The
 * canonical form lists `marka` first, then the other filters' keys in
 * order (`stok` among them), each with its values sorted,
 * then `fiyat`, `sirala` and `sayfa`; any other parameter (`utm_source`)
 * stays as it came, after them. Pure: the caller knows the keys.
 *
 * A date search (adr/0077 §2, facets-dated.ts) adds `kategori` (a
 * search's), `tarih` or `ay`, `kisi` after the filters, before `fiyat`,
 * and `sirala=kalkis`; the dates, the party and that sort only while the
 * shop sells dated products, else they are dropped (a 301 without them).
 */

import {
  DATED_PARAMS,
  DEPARTURE_SORT,
  categoryOf,
  datesOf,
  datesParam,
  paxOf,
  todayIn,
} from "./facets-dated"
import type { ListingDates } from "./facets-dated"

export const LISTING_PARAMS = {
  brand: "marka",
  stock: "stok",
  price: "fiyat",
  sort: "sirala",
  page: "sayfa",
} as const

/** `stok`'s one value: only products a shopper can have now (adr/0056). */
export const IN_STOCK_VALUE = "var"

/** Sort orders a listing offers; the first is the default and is never written. */
export const SORT_ORDERS = [
  "onerilen",
  "yeni",
  "fiyat-artan",
  "fiyat-azalan",
  DEPARTURE_SORT,
] as const
export type SortOrder = (typeof SORT_ORDERS)[number]

// A crawler trap is not a page: more than this is not answered
export const MAX_FILTER_KEYS = 6
export const MAX_FILTER_VALUES = 10
export const MAX_FILTER_VALUES_TOTAL = 12
const MAX_PAGE = 10_000

/** Products on one page of a listing; the storefront shows as many (F18). */
export const LISTING_PAGE_SIZE = 24

// Option values (adr/0013) and brand handles (docs/13 §2.1) are both of this form
const VALUE = /^[a-z0-9]+(?:[-_][a-z0-9]+)*$/
// Attribute keys (adr/0013)
const FILTER_KEY = /^[a-z][a-z0-9_]{0,63}$/
const PRICE = /^(\d{1,9})?-(\d{1,9})?$/
const PAGE = /^[1-9]\d*$/

export interface ListingQuery {
  /** By key, `marka` first then the others in order; each key's values sorted and distinct. */
  filters: [string, string[]][]
  /** Whole currency units; either end may be open. */
  price: { min: number | null; max: number | null } | null
  sort: Exclude<SortOrder, "onerilen"> | null
  /** 1 for the first page. */
  page: number
  /** Parameters that are not the listing's, as they came. */
  rest: [string, string][]
  /** A search's category handle (`kategori`), its subtree included. */
  category?: string | null
  /** Departure dates asked (`tarih` or `ay`), only while the shop sells dated products. */
  dates?: ListingDates | null
  /** Places the party takes (`kisi`); 1 when not asked. */
  pax?: number
}

/** How a listing's query is read beside its filter keys. */
export interface ListingReadOptions {
  /** The shop sells dated products (`catalog.booking`): dates, party and `kalkis` are read. */
  booking?: boolean
  /** The site search: `kategori` is its parameter. */
  search?: boolean
  /** Today in the shop's zone, `YYYY-MM-DD` (tests); else read now. */
  today?: string
}

export type ListingRead =
  | { kind: "listing"; query: ListingQuery; isCanonical: boolean }
  /** More filters, or a later page, than a listing answers: a crawler following links. */
  | { kind: "out_of_bounds" }

// Names other URLs use: the listing's own, a variant's, search and tracking parameters
const RESERVED_KEYS: ReadonlySet<string> = new Set([
  ...Object.values(LISTING_PARAMS),
  // adr/0077 §2: a date search's own, whether the shop sells dated products or not
  ...Object.values(DATED_PARAMS),
  "variant",
  "q",
  "gclid",
  "fbclid",
  "msclkid",
  "dclid",
  "yclid",
])

/** Whether a URL parameter name is taken: an attribute keyed so is no filter in the URL. */
export const isReservedParam = (key: string): boolean =>
  RESERVED_KEYS.has(key) || key.startsWith("utm_")

/** The attribute keys that can filter a listing in its URL. */
export const filterKeysOf = (keys: Iterable<string>): Set<string> =>
  new Set([...keys].filter((key) => FILTER_KEY.test(key) && !isReservedParam(key)))

// The dates and the party are the listing's even while not read: they go in its 301
const isListingKey = (
  key: string,
  filterKeys: ReadonlySet<string>,
  options: ListingReadOptions = {}
) =>
  (options.search === true && key === DATED_PARAMS.category) ||
  key === DATED_PARAMS.dates ||
  key === DATED_PARAMS.months ||
  key === DATED_PARAMS.pax ||
  key === LISTING_PARAMS.stock ||
  key === LISTING_PARAMS.price ||
  key === LISTING_PARAMS.sort ||
  key === LISTING_PARAMS.page ||
  key === LISTING_PARAMS.brand ||
  filterKeys.has(key)

function priceOf(raw: string | undefined): ListingQuery["price"] {
  const match = raw === undefined ? null : PRICE.exec(raw)
  if (!match || (match[1] === undefined && match[2] === undefined)) {
    return null
  }
  const min = match[1] === undefined ? null : Number(match[1])
  const max = match[2] === undefined ? null : Number(match[2])
  return min !== null && max !== null && min > max ? null : { min, max }
}

const sortOf = (raw: string | undefined, booking: boolean): ListingQuery["sort"] =>
  SORT_ORDERS.slice(1).find(
    (order): order is Exclude<SortOrder, "onerilen"> =>
      order === raw && (booking || order !== DEPARTURE_SORT)
  ) ?? null

// No page number, or one that is no number, is the first page; one past the cap, none
const pageNumberOf = (raw: string | undefined): number | null => {
  if (raw === undefined || !PAGE.test(raw)) {
    return 1
  }
  return raw.length > 6 || Number(raw) > MAX_PAGE ? null : Number(raw)
}

const keyOrder = (a: string, b: string) =>
  a === LISTING_PARAMS.brand ? -1 : b === LISTING_PARAMS.brand ? 1 : a < b ? -1 : a > b ? 1 : 0

function filtersOf(pairs: [string, string][], filterKeys: ReadonlySet<string>) {
  const byKey = new Map<string, Set<string>>()
  for (const [key, raw] of pairs) {
    const isOwn = key === LISTING_PARAMS.brand || key === LISTING_PARAMS.stock
    if (!isOwn && (isReservedParam(key) || !filterKeys.has(key))) {
      continue
    }
    const values = byKey.get(key) ?? new Set<string>()
    raw
      .split(",")
      .map((value) => value.trim().toLowerCase())
      .filter((value) =>
        key === LISTING_PARAMS.stock ? value === IN_STOCK_VALUE : VALUE.test(value)
      )
      .forEach((value) => values.add(value))
    byKey.set(key, values)
  }
  return [...byKey.entries()]
    .filter(([, values]) => values.size > 0)
    .map(([key, values]): [string, string[]] => [key, [...values].sort()])
    .sort(([a], [b]) => keyOrder(a, b))
}

/** The query's listing parameters in canonical order, others after them. */
export function listingSearch(query: ListingQuery): string {
  const params = new URLSearchParams()
  for (const [key, values] of query.filters) {
    params.append(key, values.join(","))
  }
  if (query.category) {
    params.append(DATED_PARAMS.category, query.category)
  }
  if (query.dates) {
    params.append(...datesParam(query.dates))
  }
  if (query.pax !== undefined && query.pax > 1) {
    params.append(DATED_PARAMS.pax, String(query.pax))
  }
  if (query.price) {
    const end = (value: number | null) => (value === null ? "" : String(value))
    params.append(LISTING_PARAMS.price, `${end(query.price.min)}-${end(query.price.max)}`)
  }
  if (query.sort) {
    params.append(LISTING_PARAMS.sort, query.sort)
  }
  if (query.page > 1) {
    params.append(LISTING_PARAMS.page, String(query.page))
  }
  for (const [key, value] of query.rest) {
    params.append(key, value)
  }
  // Commas between values read as commas, as the storefront writes them
  return params.toString().replace(/%2C/g, ",")
}

/**
 * Reads a listing's query. `isCanonical` is false when its listing
 * parameters came in another order or form (repeated, unsorted, an empty
 * or unknown value, `sayfa=1`, the default sort): the page answers with a
 * 301 to the canonical form.
 */
export function readListingQuery(
  search: URLSearchParams,
  filterKeys: ReadonlySet<string>,
  options: ListingReadOptions = {}
): ListingRead {
  const pairs = [...search.entries()]
  const own = pairs.filter(([key]) => isListingKey(key, filterKeys, options))
  const last = (key: string) => own.filter(([each]) => each === key).at(-1)?.[1]
  const filters = filtersOf(own, filterKeys)
  const page = pageNumberOf(last(LISTING_PARAMS.page))
  const values = filters.reduce((total, [, each]) => total + each.length, 0)
  if (
    page === null ||
    filters.length > MAX_FILTER_KEYS ||
    values > MAX_FILTER_VALUES_TOTAL ||
    filters.some(([, each]) => each.length > MAX_FILTER_VALUES)
  ) {
    return { kind: "out_of_bounds" }
  }
  const booking = options.booking === true
  const query: ListingQuery = {
    filters,
    price: priceOf(last(LISTING_PARAMS.price)),
    sort: sortOf(last(LISTING_PARAMS.sort), booking),
    page,
    rest: pairs.filter(([key]) => !isListingKey(key, filterKeys, options)),
  }
  const category = options.search === true ? categoryOf(last(DATED_PARAMS.category)) : null
  if (category) {
    query.category = category
  }
  if (booking) {
    const today = options.today ?? todayIn(new Date())
    const dates = datesOf(last(DATED_PARAMS.dates), last(DATED_PARAMS.months), today)
    const pax = paxOf(last(DATED_PARAMS.pax))
    if (dates) {
      query.dates = dates
    }
    if (pax > 1) {
      query.pax = pax
    }
  }
  // Only the listing's own parameters must be in order; the others stay where they came
  const came = new URLSearchParams(own).toString().replace(/%2C/g, ",")
  return { kind: "listing", query, isCanonical: came === listingSearch({ ...query, rest: [] }) }
}

/** Whether the query narrows or reorders the listing: such a page is not indexed. */
export const isNarrowed = (query: ListingQuery): boolean =>
  query.filters.length > 0 ||
  query.price !== null ||
  query.sort !== null ||
  !!query.category ||
  !!query.dates ||
  (query.pax ?? 1) > 1

/** The one filter a query holds, if it holds exactly one value and nothing else narrows it. */
export function singleFilter(query: ListingQuery): { key: string; value: string } | null {
  const [only] = query.filters
  const value = only?.[1].length === 1 ? only[1][0] : undefined
  if (
    query.filters.length !== 1 ||
    !only ||
    value === undefined ||
    query.price ||
    query.sort ||
    query.category ||
    query.dates ||
    (query.pax ?? 1) > 1
  ) {
    return null
  }
  return { key: only[0], value }
}
