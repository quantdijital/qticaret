import { SUGGEST_MIN_LENGTH } from "@qticaret/ui"
import type { SearchSuggestView } from "@qticaret/ui"
import type { PriceDisplay, StoreProduct } from "@qticaret/types"
import type { SuggestAnswer } from "@/lib/store-api/listings"
import { productCards } from "./product"
import { searchHelp, searchPath, searchStateOf } from "./search"

/** The storefront's live search address (the theme's `searchSuggest`): `GET ?q=`. */
export const SUGGEST_PATH = "/api/search/suggest"

/** The products the panel shows at most. */
export const SUGGESTED_PRODUCTS = 6

/** The categories, and the brands, the panel offers at most (`/arama` lists them all). */
export const SUGGESTED_LINKS = 4

/**
 * The words a live search asks for: `/arama`'s own reading (trimmed, cut
 * at the backend's length, the first `q`), runs of spaces as one, so
 * "çakı " and "çakı" are one answer kept. Null below the themes' own
 * minimum (`SUGGEST_MIN_LENGTH`, two characters).
 */
export function suggestWordsOf(search: URLSearchParams): string | null {
  const q = searchStateOf(search).q.replace(/\s+/g, " ")
  return Array.from(q).length >= SUGGEST_MIN_LENGTH ? q : null
}

/** Nothing found: the panel's empty state, its "see all" still the page's. */
export const emptySuggestion = (q: string): SearchSuggestView => ({
  q,
  total: 0,
  allPath: searchPath(q),
  products: [],
  categories: [],
  brands: [],
  suggestions: [],
})

/**
 * The live search's answer as the panel shows it: the hits in the
 * search's order, each with the price its card shows (the 30-day rule's
 * struck price included, formatted here); those without a live path left
 * out. The suggestions, categories and brands are `/arama`'s own links
 * (`searchHelp`): each phrase its own search, each category at its page,
 * each brand this search narrowed to it; four categories and four brands
 * at most.
 */
export function suggestView({
  q,
  answer,
  products,
  productPaths,
  displays,
  categoryPaths,
}: {
  q: string
  answer: SuggestAnswer
  products: readonly StoreProduct[]
  productPaths: Record<string, string>
  displays: Record<string, PriceDisplay>
  categoryPaths: Record<string, string>
}): SearchSuggestView {
  const byId = new Map(products.map((product) => [product.id, product]))
  const ordered = answer.product_ids
    .slice(0, SUGGESTED_PRODUCTS)
    .flatMap((id) => byId.get(id) ?? [])
  const help = searchHelp(
    searchStateOf(new URLSearchParams({ q })),
    { suggestions: answer.suggestions, related: answer.related, took_ms: 0 },
    categoryPaths
  )
  return {
    ...emptySuggestion(q),
    total: answer.count,
    products: productCards(ordered, productPaths, displays).map(
      ({ id, title, path, image, price }) => ({ id, title, path, image, price })
    ),
    categories: (help?.categories ?? []).slice(0, SUGGESTED_LINKS),
    brands: (help?.brands ?? []).slice(0, SUGGESTED_LINKS),
    suggestions: help?.suggestions ?? [],
  }
}
