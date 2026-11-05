import type { SearchSuggestView } from "@qticaret/ui"
import { isStoreApiError } from "@/lib/store-api/errors"
import { suggestPage } from "@/lib/store-api/listings"
import { listProducts, pathsOf, priceDisplays } from "@/lib/store-api/requests"
import { variantIdsOf } from "@/lib/views/product"
import {
  SUGGESTED_PRODUCTS,
  emptySuggestion,
  suggestView,
  suggestWordsOf,
} from "@/lib/views/search-suggest"

// Every answer is the shopper's: never a cached page
export const dynamic = "force-dynamic"

// The prices are the shopper's own (a signed-in customer's group): kept by nobody on the way
const PRIVATE = { "cache-control": "private, no-store" }

/** The panel's answer: the search (kept a minute, shop-wide), then the hits' cards, priced now. */
async function suggestionsFor(q: string): Promise<SearchSuggestView> {
  const answer = await suggestPage(q)
  const ids = answer.product_ids.slice(0, SUGGESTED_PRODUCTS)
  const [{ products }, productPaths, categoryPaths] = await Promise.all([
    ids.length > 0 ? listProducts({ ids, limit: ids.length }) : { products: [] },
    pathsOf("product", ids),
    pathsOf(
      "product_category",
      answer.related.categories.map((category) => category.id)
    ),
  ])
  const displays = await priceDisplays(variantIdsOf(products))
  return suggestView({ q, answer, products, productPaths, displays, categoryPaths })
}

/**
 * `GET /api/search/suggest?q=` (live search, 2026-11-05): the header's
 * panel as the shopper types, from the storefront's server only (adr/0046
 * §5: the browser never calls the backend). The backend's site search
 * (full text, typos, synonyms; never counted for the search report), its
 * first six hits as the cards price them, its categories, brands and "did
 * you mean" phrases, and how many `/arama` would list. Words the search
 * cannot read answer as nothing found; fewer than two characters are a
 * 400; a failure is a 502 (the backend's 429 passed on), and the form
 * still goes to `/arama`.
 */
export async function GET(request: Request): Promise<Response> {
  const q = suggestWordsOf(new URL(request.url).searchParams)
  if (q === null) {
    return Response.json({ message: "search.suggest_short" }, { status: 400, headers: PRIVATE })
  }
  try {
    return Response.json(await suggestionsFor(q), { headers: PRIVATE })
  } catch (error) {
    if (isStoreApiError(error) && error.status === 400) {
      return Response.json(emptySuggestion(q), { headers: PRIVATE })
    }
    const status = isStoreApiError(error) && error.status === 429 ? 429 : 502
    return Response.json({ message: "search.suggest_failed" }, { status, headers: PRIVATE })
  }
}
