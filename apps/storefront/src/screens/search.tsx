import { notFound, permanentRedirect, redirect } from "next/navigation"
import type { BreadcrumbView, SearchFormView } from "@qticaret/ui"
import { t } from "@/lib/i18n"
import { isNotFound, isStoreApiError } from "@/lib/store-api/errors"
import { searchPage } from "@/lib/store-api/listings"
import { interpretSentence } from "@/lib/store-api/search-interpret"
import type { ListingAnswer } from "@/lib/store-api/listings"
import { allCategories, pathsOf } from "@/lib/store-api/requests"
import { hrefOf, priceAsked, withPrice } from "@/lib/views/listing"
import { categoryTiles } from "@/lib/views/category-tiles"
import {
  NO_DATED,
  cardDatesOf,
  datedFromForm,
  isDated,
  isFormAddress,
} from "@/lib/views/dated-search"
import {
  asksReading,
  isUnderstood,
  understoodPath,
  understoodView,
  withoutMark,
} from "@/lib/views/natural-search"
import { naturalHintOf, naturalSearchOn } from "@/lib/views/natural-search-on"
import { EMPTY_VALUES } from "@/lib/views/search-form"
import { currentSearchForm } from "@/lib/views/search-form-data"
import {
  SEARCH_PATH,
  canonicalSearchPath,
  searchHelp,
  searchStateOf,
  searchTitle,
  withTiles,
} from "@/lib/views/search"
import { theme } from "@/theme"
import { ListingContent } from "./listing"
import { type Query, toSearch } from "./shop"

const breadcrumbs = (): BreadcrumbView[] => [
  { label: t("home.label"), path: "/" },
  { label: t("search.title"), path: null },
]

/** A search page with no list: nothing asked yet, or words the search cannot read. */
async function SearchMessage({
  title,
  words,
  form,
  hint,
}: {
  title: string
  words: string
  form: SearchFormView
  hint: string | null
}) {
  // The shop's categories to start from instead (adr/0046 Ek 2026-11-05)
  const popular = await categoryTiles([])
  return (
    <theme.ListingPage
      t={t}
      view={{
        search: { suggestions: [], categories: [], brands: [], popular },
        searchForm: form,
        searchHint: hint,
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
async function answerOf(q: string | null, query: string): Promise<ListingAnswer | null> {
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

/** The address's own query beside the words, as it came: the backend says whether it is canonical. */
function queryOf(search: URLSearchParams): string {
  const rest = new URLSearchParams(search)
  rest.delete("q")
  return rest.toString().replace(/%2C/g, ",")
}

/**
 * `/arama?q=` (adr/0046 ek 2026-11-03): the catalogue weighed against the
 * words with typo tolerance, through the listing's own filters, sorts
 * (relevance first) and pages; "did you mean" and related category and
 * brand chips above. Without words a category, dates (`tarih`, `ay`) or
 * a filter narrow the whole catalogue (adr/0077 §2); the shop's search box
 * stands over the list with the values asked (§1). The box's GET form
 * (two day fields, empty fields) moves once to its clean address, and a
 * query the backend reads in another form moves once (301) to its
 * canonical one. Words the search cannot read show the empty page with a
 * hint, never an error. The backend counts the first, unfiltered page for
 * the search report (F11.8). Never indexed. While the shop reads
 * sentences (adr/0077 §7), words alone that make a sentence are read into
 * filters and the page moves once (307) to them, marked, where the parts
 * read show as "Anladığım:" chips; whatever fails, the words are searched
 * as they are.
 */
export async function SearchScreen({ query }: { query: Query }) {
  const given = toSearch(query)
  const understood = isUnderstood(given)
  // The mark is the page's own: never a filter, never sent to the backend
  const search = withoutMark(given)
  // The price form's two fields become one `fiyat`, the box's two days one `tarih`
  const asked = priceAsked(search)
  if (asked !== undefined || isFormAddress(search)) {
    const read = { ...searchStateOf(search), dated: datedFromForm(search) }
    redirect(hrefOf(SEARCH_PATH, asked === undefined ? read : withPrice(read, asked)))
  }
  const natural = await naturalSearchOn()
  if (asksReading(search, natural)) {
    const reading = await interpretSentence(search.get("q") ?? "")
    const path = reading ? understoodPath(reading) : null
    if (path) {
      redirect(path)
    }
  }
  const state = searchStateOf(search)
  const { q } = state
  const dated = state.dated ?? NO_DATED
  const values = { q, filters: state.filters, dated }
  if (!q && !isDated(dated) && state.filters.length === 0) {
    const form = await currentSearchForm(EMPTY_VALUES, t)
    return (
      <SearchMessage
        title={t("search.title")}
        words={t("search.prompt")}
        form={form}
        hint={naturalHintOf(natural, form, t)}
      />
    )
  }
  const answer = await answerOf(q || null, queryOf(search))
  if (answer?.canonical_query !== undefined) {
    permanentRedirect(canonicalSearchPath(q, answer.canonical_query))
  }
  const [form, categories] = await Promise.all([
    currentSearchForm(values, t),
    allCategories().catch(() => []),
  ])
  const title = searchTitle(state, categories, answer?.facets.attributes ?? [], t)
  const hint = naturalHintOf(natural, form, t)
  if (!answer) {
    return <SearchMessage title={title} words={t("search.invalid")} form={form} hint={hint} />
  }
  const related = answer.search?.related.categories ?? []
  // The related categories as picture tiles; nothing found: the shop's own categories to start from
  const [categoryPaths, tiles, popular] = await Promise.all([
    pathsOf(
      "product_category",
      related.map((category) => category.id)
    ),
    categoryTiles(related.map((category) => category.id)),
    answer.count === 0 ? categoryTiles([]) : Promise.resolve(undefined),
  ])
  const help = searchHelp(state, answer.search, categoryPaths)
  return (
    <ListingContent
      type="search"
      load={() => Promise.resolve(answer)}
      state={state}
      url={new URL(SEARCH_PATH, "http://storefront.invalid")}
      heading={() => Promise.resolve({ title, description: [], subcategories: [] })}
      breadcrumbs={breadcrumbs}
      jsonLd={[]}
      cardDates={cardDatesOf(dated)}
      extra={{
        search: withTiles(help, tiles, popular),
        searchForm: form,
        searchHint: hint,
        understood: understood
          ? understoodView(state, categories, answer.facets.attributes, t)
          : null,
        empty: q ? t("search.none", { q }) : t("search.dated_none"),
      }}
    />
  )
}
