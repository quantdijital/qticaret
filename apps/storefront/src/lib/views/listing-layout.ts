import { LISTING_VIEWS, LISTING_VIEW_PARAM, LISTING_VIEW_WORDS } from "@qticaret/types/listing-page"
import type { ListingPageSettings, ListingViewMode } from "@qticaret/types/listing-page"
import type {
  BreadcrumbView,
  DateFilterView,
  LinkView,
  ListingViewSwitchView,
  Translate,
} from "@qticaret/ui"
import { NO_DATED, monthWords, rangeWords } from "./dated-search"
import type { DatedState } from "./dated-search"
import { hrefOf, searchOf } from "./listing"
import type { ListingState } from "./listing"
import { monthsFrom } from "./search-form"

/**
 * A listing page's own layout (`StoreThemeSettings.listing_page`): its
 * products as a grid or a list and the shopper's switch between them, its
 * trail, and a dated shop's departure month filter. Every default draws
 * the page as it was.
 */

/** How many months the date filter offers, this one first (the search box offers twelve). */
export const DATE_FILTER_MONTHS = 6

/** The grid or list drawn: the shopper's while the shop offers the switch, else the shop's. */
export const layoutOf = (settings: ListingPageSettings, state: ListingState): ListingViewMode =>
  settings.view_switch === "show" && state.view ? state.view : settings.default_view

/**
 * The switch beside the sort while the shop offers it: a GET form whose
 * two buttons write `gorunum`, every other parameter of the page kept.
 */
export function viewSwitchView(
  pathname: string,
  state: ListingState,
  settings: ListingPageSettings,
  t: Translate
): ListingViewSwitchView | null {
  if (settings.view_switch !== "show") {
    return null
  }
  const current = layoutOf(settings, state)
  const keep = [...new URLSearchParams(searchOf({ ...state, view: null })).entries()].map(
    ([name, value]) => ({ name, value })
  )
  return {
    label: t("listing.view"),
    action: pathname,
    name: LISTING_VIEW_PARAM,
    options: LISTING_VIEWS.map((mode) => ({
      mode,
      value: LISTING_VIEW_WORDS[mode],
      label: t(`listing.view_${mode}`),
      current: mode === current,
    })),
    keep,
  }
}

/**
 * The trail as the shop shows it: without its last crumb (the page
 * itself, which the title names) when the shop hides it. The page's
 * `BreadcrumbList` data is written apart and keeps it (docs/13).
 */
export function trailOf(crumbs: BreadcrumbView[], settings: ListingPageSettings): BreadcrumbView[] {
  const last = crumbs.at(-1)
  return settings.breadcrumb_current === "hide" && crumbs.length > 1 && last?.path === null
    ? crumbs.slice(0, -1)
    : crumbs
}

/**
 * The count in the shop's own word ("24 tur") and the filter sheet's
 * button with it ("24 tur göster"); none while the shop writes no word,
 * the page then saying "ürün" as it did.
 */
export function countWordsOf(
  total: number,
  settings: ListingPageSettings,
  t: Translate
): { countLabel: string; showResultsLabel: string } | Record<string, never> {
  const word = settings.count_word
  if (!word) {
    return {}
  }
  return {
    countLabel: t("listing.count_word", { count: total, word }),
    showResultsLabel: t("listing.show_results_word", { count: total, word }),
  }
}

/** The state with these dates (none: no dates), from the first page. */
function withDated(state: ListingState, dated: DatedState): ListingState {
  const next: ListingState = {
    filters: state.filters,
    price: state.price,
    sort: state.sort,
    page: 1,
  }
  if (state.q !== undefined) {
    next.q = state.q
  }
  if (state.view !== undefined) {
    next.view = state.view
  }
  const on = dated.category !== null || dated.range !== null || dated.months !== null
  if (on || dated.pax > 1) {
    next.dated = dated
  }
  return next
}

/** The page without its dates (`tarih`, `ay`), its party and category kept. */
const undated = (state: ListingState): ListingState =>
  withDated(state, { ...(state.dated ?? NO_DATED), range: null, months: null })

/**
 * The departure month filter: the next months, each a link that asks
 * that month (`ay`, the search box's own parameter; the backend reads and
 * checks it on every listing of a shop selling dated products) or lets
 * it go. One month at a time; a range from the search box shows none
 * chosen, its chip takes it away.
 */
export function dateFilterView(
  pathname: string,
  state: ListingState,
  today: string,
  t: Translate
): DateFilterView {
  const dated = state.dated ?? NO_DATED
  const chosen = dated.range ? [] : (dated.months?.split(",") ?? [])
  return {
    label: t("listing.dates"),
    options: monthsFrom(today)
      .slice(0, DATE_FILTER_MONTHS)
      .map((month) => {
        const selected = chosen.includes(month)
        const next = selected
          ? undated(state)
          : withDated(state, { ...dated, range: null, months: month })
        return { label: monthWords(month), path: hrefOf(pathname, next), selected }
      }),
  }
}

/** The dates asked as a chip that takes them away; none without dates. */
export function datedChip(pathname: string, state: ListingState): LinkView | null {
  const dated = state.dated
  const label = dated?.range
    ? rangeWords(dated.range)
    : dated?.months
      ? dated.months.split(",").map(monthWords).join(", ")
      : null
  return label ? { label, path: hrefOf(pathname, undated(state)) } : null
}
