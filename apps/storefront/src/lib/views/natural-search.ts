import type { Translate, UnderstoodView } from "@qticaret/ui"
import type { ListingAnswer } from "@/lib/store-api/listings"
import { NO_DATED, monthWords, rangeWords } from "./dated-search"
import type { DatedState } from "./dated-search"
import { hrefOf, toggled } from "./listing"
import type { ListingState } from "./listing"
import { SEARCH_PATH } from "./search"

/**
 * Search in the shopper's own words (adr/0077 §7): `/arama?q=<a sentence>`
 * is read by the backend (`POST /store/search/interpret`) into the
 * search's own filters, and the page moves once (307) to that canonical
 * address with a mark (`_anlam=1`); there the parts the backend took are
 * shown as "Anladığım:" chips, each a link that takes it away. The chips
 * are built from the address the backend checks again (the page's own
 * filters with the shop's names), never from what the service wrote.
 * The mark's name fails the filter key form (`[a-z]…`), so no attribute
 * can be called so; it never reaches the backend.
 */

/** The mark on an address the sentence was read into. */
export const UNDERSTOOD_MARK = "_anlam"

/** Words from which a search reads as a sentence ("ağustosta iki kişi Kapadokya"). */
export const SENTENCE_WORDS = 3

/** The backend's answer (`StoreSearchInterpretation`): the query only is used here. */
export interface SearchInterpretation {
  query: string
  understood: { kind: string; label: string; param: string; value: string }[]
  dropped: { kind: string; reason: string }[]
  fallback?: true
}

/** Whether the address came from a sentence read into filters. */
export const isUnderstood = (search: URLSearchParams): boolean => search.has(UNDERSTOOD_MARK)

/** The address without the mark: the search as the backend reads it. */
export function withoutMark(search: URLSearchParams): URLSearchParams {
  const rest = new URLSearchParams(search)
  rest.delete(UNDERSTOOD_MARK)
  return rest
}

/**
 * Whether to ask the backend to read the words: the shop has it on, the
 * address holds the words alone (a box's category, dates or filters are
 * the shopper's own choice and stay), not read already, and they are a
 * sentence rather than a product's name.
 */
export function asksReading(search: URLSearchParams, on: boolean): boolean {
  if (!on || isUnderstood(search)) {
    return false
  }
  const names = new Set(search.keys())
  if (names.size !== 1 || !names.has("q")) {
    return false
  }
  const words = (search.get("q") ?? "").trim().split(/\s+/).filter(Boolean)
  return words.length >= SENTENCE_WORDS
}

/**
 * Where a reading moves: its canonical query with the mark; null when
 * the backend searched the words as they are (`fallback`) or its query
 * is not a search's (the page then goes on with the plain words).
 */
export function understoodPath(answer: SearchInterpretation): string | null {
  if (answer.fallback || answer.understood.length === 0) {
    return null
  }
  const query = answer.query.trim()
  if (!query || query.startsWith("?") || /[\s#]/.test(query)) {
    return null
  }
  return `${SEARCH_PATH}?${query}&${UNDERSTOOD_MARK}=1`
}

const marked = (state: ListingState): string => {
  const path = hrefOf(SEARCH_PATH, { ...state, page: 1 })
  return `${path}${path.includes("?") ? "&" : "?"}${UNDERSTOOD_MARK}=1`
}

const withDated = (state: ListingState, dated: Partial<DatedState>): ListingState => ({
  ...state,
  dated: { ...(state.dated ?? NO_DATED), ...dated },
})

/**
 * The "Anladığım:" chips of a read sentence: the category, each filter
 * value, the dates (each month its own) and the party, by the shop's
 * names; a part the page cannot name is left out. Each chip's link is
 * the search without it, still marked. Null when nothing is left.
 */
export function understoodView(
  state: ListingState,
  categories: readonly { handle: string; name: string }[],
  attributes: ListingAnswer["facets"]["attributes"],
  t: Translate
): UnderstoodView | null {
  const dated = state.dated ?? NO_DATED
  const parts: { label: string; path: string }[] = []
  const category = categories.find((each) => each.handle === dated.category)?.name
  if (category) {
    parts.push({ label: category, path: marked(withDated(state, { category: null })) })
  }
  for (const [key, values] of state.filters) {
    const named = attributes.find((attribute) => attribute.key === key)?.values ?? []
    for (const value of values) {
      const label = named.find((each) => each.value === value)?.label
      if (label) {
        parts.push({ label, path: marked(toggled(state, key, value)) })
      }
    }
  }
  const range = dated.range ? rangeWords(dated.range) : null
  if (dated.range && range) {
    parts.push({ label: range, path: marked(withDated(state, { range: null })) })
  }
  const months = dated.range ? [] : (dated.months?.split(",") ?? [])
  for (const month of months) {
    const rest = months.filter((each) => each !== month)
    parts.push({
      label: monthWords(month),
      path: marked(withDated(state, { months: rest.length > 0 ? rest.join(",") : null })),
    })
  }
  if (dated.pax > 1) {
    parts.push({
      label: t("search.form_people_count", { count: dated.pax }),
      path: marked(withDated(state, { pax: 1 })),
    })
  }
  if (parts.length === 0) {
    return null
  }
  return {
    title: t("search.understood"),
    parts: parts.map((part) => ({
      ...part,
      remove: t("listing.remove_filter", { label: part.label }),
    })),
  }
}
