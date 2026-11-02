import { notFound, redirect } from "next/navigation"
import type { BreadcrumbView } from "@qticaret/ui"
import { t } from "@/lib/i18n"
import { isNotFound, isStoreApiError } from "@/lib/store-api/errors"
import { searchPage } from "@/lib/store-api/listings"
import type { ListingAnswer } from "@/lib/store-api/listings"
import { pathsOf } from "@/lib/store-api/requests"
import { hrefOf, listingQueryOf, priceAsked, withPrice } from "@/lib/views/listing"
import { SEARCH_PATH, searchHelp, searchStateOf } from "@/lib/views/search"
import { theme } from "@/theme"
import { ListingContent } from "./listing"
import { type Query, toSearch } from "./shop"

const breadcrumbs = (): BreadcrumbView[] => [
  { label: t("home.label"), path: "/" },
  { label: t("search.title"), path: null },
]

/** A search page with no list: nothing asked yet, or words the search cannot read. */
function SearchMessage({ title, words }: { title: string; words: string }) {
  return (
    <theme.ListingPage
      t={t}
      view={{
        title,
        description: [words],
        breadcrumbs: breadcrumbs(),
        subcategories: [],
        products: [],
        total: 0,
        sort: [],
        filters: [],
        price: null,
        active: [],
        clearPath: null,
        pagination: { page: 1, pages: 1, previous: null, next: null, pagePath: { 1: SEARCH_PATH } },
      }}
    />
  )
}

/** The search's answer; null when the backend could not read the words (a 400). */
async function answerOf(q: string, query: string): Promise<ListingAnswer | null> {
  try {
    return await searchPage(q, query)
  } catch (error) {
    if (isStoreApiError(error) && error.status === 400) {
      return null
    }
    // More filters than a listing answers
    if (isNotFound(error)) {
      notFound()
    }
    throw error
  }
}

/**
 * `/arama?q=` (adr/0046 ek 2026-11-03): the catalogue weighed against the
 * words with typo tolerance, through the listing's own filters, sorts
 * (relevance first) and pages; "did you mean" and related category and
 * brand chips above. Words the search cannot read show the empty page
 * with a hint, never an error. The backend counts the first, unfiltered
 * page for the search report (F11.8). Never indexed.
 */
export async function SearchScreen({ query }: { query: Query }) {
  const search = toSearch(query)
  const state = searchStateOf(search)
  const { q } = state
  if (!q) {
    return <SearchMessage title={t("search.title")} words={t("search.prompt")} />
  }
  // The price form's two fields become one `fiyat` before anything is asked
  const asked = priceAsked(search)
  if (asked !== undefined) {
    redirect(hrefOf(SEARCH_PATH, withPrice(state, asked)))
  }
  const answer = await answerOf(q, listingQueryOf(state))
  const title = t("search.results_for", { q })
  if (!answer) {
    return <SearchMessage title={title} words={t("search.invalid")} />
  }
  const related = answer.search?.related.categories ?? []
  const categoryPaths = await pathsOf(
    "product_category",
    related.map((category) => category.id)
  )
  return (
    <ListingContent
      type="search"
      load={() => Promise.resolve(answer)}
      state={state}
      url={new URL(SEARCH_PATH, "http://storefront.invalid")}
      heading={() => Promise.resolve({ title, description: [], subcategories: [] })}
      breadcrumbs={breadcrumbs}
      jsonLd={[]}
      extra={{
        search: searchHelp(state, answer.search, categoryPaths),
        empty: t("search.none", { q }),
      }}
    />
  )
}
