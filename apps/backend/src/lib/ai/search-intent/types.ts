import type { ListingDates } from "../../seo/facets-dated"

/**
 * A storefront search in the shopper's own words (adr/0077 §7): the
 * shop's closed lists the sentence is read against, the filter the
 * server accepts of the service's answer, and what it left out. Only
 * a filter comes out: no product is picked or ranked by the service.
 */

/** The longest sentence a shopper may send. */
export const SEARCH_TEXT_MAX = 200

/** Shown categories named to the service at most. */
export const MAX_SEARCH_CATEGORIES = 150
/** Filterable attributes named at most, and options of each. */
export const MAX_SEARCH_ATTRIBUTES = 20
export const MAX_SEARCH_OPTIONS = 40

export interface SearchCategory {
  /** The category's handle, `kategori`'s value. */
  handle: string
  /** "Üst > Alt" under a parent. */
  name: string
}

export interface SearchAttribute {
  /** The attribute's key, its URL parameter. */
  key: string
  label: string
  values: readonly { value: string; label: string }[]
}

/** What the sentence is read against: the shop's own lists and its today. */
export interface SearchLists {
  categories: readonly SearchCategory[]
  attributes: readonly SearchAttribute[]
  /** Today in the shop's zone, `YYYY-MM-DD`. */
  today: string
  /** The shop sells dated products (`catalog.booking`): dates and the party are read. */
  booking: boolean
}

/** The filter the server accepted; every value is one of the shop's or passed the dated rules. */
export interface SearchFilter {
  /** Words of the shopper's own sentence, as the site search reads them. */
  q?: string
  category?: string
  dates?: ListingDates
  pax?: number
  /** By key, sorted; each key's values sorted and distinct. */
  attributes?: [string, string[]][]
}

export const SEARCH_FIELDS = ["q", "kategori", "tarih", "ay", "kisi", "nitelik"] as const
export type SearchField = (typeof SEARCH_FIELDS)[number]

/**
 * A part of the answer left out, and why; never the service's own words.
 * `unknown`: not in the shop's lists; `invalid`: not of its form or out
 * of its bounds (a past or far date); `not_offered`: the shop does not
 * read it (dates while it sells no dated product).
 */
export interface DroppedPart {
  kind: SearchField
  reason: "unknown" | "invalid" | "not_offered"
}

/** One "Anladığım" chip, built from the accepted filter: its parameter and canonical value. */
export interface UnderstoodPart {
  kind: SearchField
  label: string
  param: string
  value: string
}

/** The route's answer. */
export interface SearchInterpretation {
  /** The search's query string, canonical (`q` first, then the listing's own order). */
  query: string
  understood: UnderstoodPart[]
  dropped: DroppedPart[]
  /** The sentence was searched as it is (`q=<metin>`): no service, or no usable answer. */
  fallback?: true
}
