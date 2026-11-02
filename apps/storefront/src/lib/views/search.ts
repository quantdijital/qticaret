import type { SearchHelpView } from "@qticaret/ui"
import type { ListingAnswer } from "@/lib/store-api/listings"
import { hrefOf, stateFromSearch, toggled } from "./listing"
import type { ListingState } from "./listing"

export const SEARCH_PATH = "/arama"

/** The longest search the listing route reads (backend `MAX_QUERY_LENGTH`). */
const MAX_QUERY = 100

const BRAND = "marka"

/**
 * `/arama?q=…`'s words and the listing's own query beside them (filters,
 * price, sort, page): the words trimmed to what the backend reads, the
 * first `q` when several came.
 */
export function searchStateOf(search: URLSearchParams): ListingState & { q: string } {
  const q = (search.get("q") ?? "")
    .trim()
    .slice(0, MAX_QUERY)
    // Never half a character at the cut
    .replace(/[\uD800-\uDBFF]$/, "")
    .trim()
  return { ...stateFromSearch(search), q }
}

/** A new search for these words, from its first page. */
export const searchPath = (q: string): string =>
  `${SEARCH_PATH}?${new URLSearchParams({ q }).toString()}`

/**
 * A search's help as links (adr/0046 ek 2026-11-03): each "did you mean"
 * phrase its own search; the related categories at their pages (those
 * without a live path left out); the related brands as this search
 * narrowed to the brand, those chosen already left out. Null when there
 * is nothing to offer.
 */
export function searchHelp(
  state: ListingState,
  search: ListingAnswer["search"],
  categoryPaths: Record<string, string>
): SearchHelpView | null {
  if (!search) {
    return null
  }
  const chosen = state.filters.find(([key]) => key === BRAND)?.[1] ?? []
  const help: SearchHelpView = {
    suggestions: search.suggestions.map((phrase) => ({ label: phrase, path: searchPath(phrase) })),
    categories: search.related.categories.flatMap((category) => {
      const path = categoryPaths[category.id]
      return path ? [{ label: category.name, path }] : []
    }),
    brands: search.related.brands
      .filter((brand) => !chosen.includes(brand.handle))
      .map((brand) => ({
        label: brand.name,
        path: hrefOf(SEARCH_PATH, toggled(state, BRAND, brand.handle)),
      })),
  }
  return help.suggestions.length + help.categories.length + help.brands.length > 0 ? help : null
}
