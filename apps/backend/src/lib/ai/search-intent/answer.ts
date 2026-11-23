import { MAX_QUERY_LENGTH } from "../../search"
import { DATED_PARAMS, datesParam } from "../../seo/facets-dated"
import type { ListingDates } from "../../seo/facets-dated"
import { listingSearch } from "../../seo/facets"
import type {
  DroppedPart,
  SearchFilter,
  SearchInterpretation,
  SearchLists,
  UnderstoodPart,
} from "./types"

/**
 * The route's answer from the accepted filter alone (adr/0077 §7): the
 * search's query string in its canonical form, and the "Anladığım" chips,
 * each labelled with the shop's own names or a date the server formats.
 * Nothing the service wrote reaches it: `q` is the shopper's own words.
 */

/** The search's text parameter, before the listing's own. */
export const SEARCH_TEXT_PARAM = "q"

const dayFormat = new Intl.DateTimeFormat("tr-TR", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
})
const monthFormat = new Intl.DateTimeFormat("tr-TR", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
})

const utcDay = (day: string): Date => new Date(`${day}T00:00:00Z`)

function datesParts(dates: ListingDates): UnderstoodPart[] {
  const [param, value] = datesParam(dates)
  if (dates.kind === "range") {
    const label = dayFormat.formatRange(utcDay(dates.from), utcDay(dates.to))
    return [{ kind: "tarih", label, param, value }]
  }
  return dates.months.map((month) => ({
    kind: "ay" as const,
    label: monthFormat.format(utcDay(`${month}-01`)),
    param,
    value: month,
  }))
}

/** The query string: `q` first, then the listing's parameters in their canonical order. */
export function searchQueryOf(filter: SearchFilter): string {
  const text = new URLSearchParams()
  if (filter.q !== undefined) {
    text.append(SEARCH_TEXT_PARAM, filter.q)
  }
  const listing = listingSearch({
    filters: filter.attributes ?? [],
    price: null,
    sort: null,
    page: 1,
    rest: [],
    ...(filter.category === undefined ? {} : { category: filter.category }),
    ...(filter.dates === undefined ? {} : { dates: filter.dates }),
    ...(filter.pax === undefined ? {} : { pax: filter.pax }),
  })
  return [text.toString(), listing].filter((part) => part !== "").join("&")
}

/** The chips, in the query's order. */
export function understoodOf(filter: SearchFilter, lists: SearchLists): UnderstoodPart[] {
  const parts: UnderstoodPart[] = []
  if (filter.q !== undefined) {
    parts.push({ kind: "q", label: filter.q, param: SEARCH_TEXT_PARAM, value: filter.q })
  }
  for (const [key, values] of filter.attributes ?? []) {
    const attribute = lists.attributes.find((each) => each.key === key)
    for (const value of values) {
      const label = attribute?.values.find((each) => each.value === value)?.label ?? value
      parts.push({ kind: "nitelik", label, param: key, value })
    }
  }
  if (filter.category !== undefined) {
    const name = lists.categories.find((each) => each.handle === filter.category)?.name
    parts.push({
      kind: "kategori",
      label: name ?? filter.category,
      param: DATED_PARAMS.category,
      value: filter.category,
    })
  }
  if (filter.dates !== undefined) {
    parts.push(...datesParts(filter.dates))
  }
  if (filter.pax !== undefined) {
    const value = String(filter.pax)
    parts.push({ kind: "kisi", label: value, param: DATED_PARAMS.pax, value })
  }
  return parts
}

/** Whether the filter narrows anything: an empty one searches nothing. */
export const isEmptyFilter = (filter: SearchFilter): boolean =>
  filter.q === undefined &&
  filter.category === undefined &&
  filter.dates === undefined &&
  filter.pax === undefined &&
  (filter.attributes ?? []).length === 0

/** The sentence searched as it is, cut to what the site search reads. */
export function fallbackAnswer(text: string, dropped: DroppedPart[] = []): SearchInterpretation {
  const q = text.replace(/\s+/g, " ").trim().slice(0, MAX_QUERY_LENGTH).trim()
  const query = new URLSearchParams([[SEARCH_TEXT_PARAM, q]]).toString()
  return { query, understood: [], dropped, fallback: true }
}

/** The answer of an accepted filter; the sentence as it is when the filter is empty. */
export function searchAnswer(
  text: string,
  filter: SearchFilter,
  dropped: DroppedPart[],
  lists: SearchLists
): SearchInterpretation {
  if (isEmptyFilter(filter)) {
    return fallbackAnswer(text, dropped)
  }
  return { query: searchQueryOf(filter), understood: understoodOf(filter, lists), dropped }
}
