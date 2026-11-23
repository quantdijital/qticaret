import type { CategoryCardView, SearchHelpView, Translate } from "@qticaret/ui"
import type { ListingAnswer } from "@/lib/store-api/listings"
import { NO_DATED, datedWords } from "./dated-search"
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

/**
 * Where a search moves when the backend read its query in another form
 * (adr/0077 §2): the words first, then the canonical query as given.
 */
export function canonicalSearchPath(q: string, canonical: string): string {
  const parts = [q ? new URLSearchParams({ q }).toString() : "", canonical].filter(Boolean)
  return parts.length > 0 ? `${SEARCH_PATH}?${parts.join("&")}` : SEARCH_PATH
}

/**
 * A search's title (adr/0077 §1): its words ("“çakı” için sonuçlar"), the
 * category and filter values asked by their names, the dates and party in
 * words, joined by " · " ("Kapadokya · 1–10 Ara · 2 kişi"); "Arama" when
 * nothing is named.
 */
export function searchTitle(
  state: ListingState & { q: string },
  categories: readonly { handle: string; name: string }[],
  attributes: ListingAnswer["facets"]["attributes"],
  t: Translate
): string {
  const dated = state.dated ?? NO_DATED
  const category = categories.find((each) => each.handle === dated.category)?.name
  const values = state.filters.flatMap(([key, chosen]) => {
    const values = attributes.find((attribute) => attribute.key === key)?.values ?? []
    return chosen.flatMap((value) => values.find((each) => each.value === value)?.label ?? [])
  })
  const parts = [
    ...(state.q ? [t("search.results_for", { q: state.q })] : []),
    ...(category ? [category] : []),
    ...values,
    ...datedWords(dated, t),
  ]
  return parts.length > 0 ? parts.join(" · ") : t("search.title")
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

/**
 * A search's help with its related categories as picture tiles (the same
 * categories in the same order, each with its picture when the shop's
 * catalogue has one; adr/0046 Ek 2026-11-05) and, where the search found
 * nothing, the shop's categories to start from. Null when there is still
 * nothing to offer.
 */
export function withTiles(
  help: SearchHelpView | null,
  tiles: readonly CategoryCardView[],
  popular: CategoryCardView[] | undefined
): SearchHelpView | null {
  if (!help && !popular?.length) {
    return null
  }
  const base = help ?? { suggestions: [], categories: [], brands: [] }
  const byPath = new Map(tiles.map((tile) => [tile.path, tile]))
  return {
    ...base,
    categories: base.categories.map((link) => byPath.get(link.path) ?? link),
    ...(popular && popular.length > 0 ? { popular } : {}),
  }
}
