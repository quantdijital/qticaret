import type { ListingCrumbsPlace, ListingTextSettings, ListingViewMode } from "@qticaret/types"
import type { SearchFormView } from "./search-form-views"
import type { CategoryCardView } from "./card-views"
import type { HomeSectionView } from "./content-views"
import type { CategoryMainView } from "./main-views"
import type { BreadcrumbView, ProductCardView } from "./product-views"
import type { ImageView, LinkView } from "./views"

/**
 * A listing as a theme shows it (adr/0046 §7): its pages, sort and
 * filters, the category and brand indexes.
 */

export interface PaginationView {
  page: number
  pages: number
  /** Path of each page, query kept; null when there is no such page. */
  previous: string | null
  next: string | null
  pagePath: Record<number, string>
}

export interface SortOptionView {
  label: string
  path: string
  current: boolean
}

/** One value of a filter: a link that chooses it or lets it go (nofollow, D4). */
export interface FilterOptionView {
  label: string
  count: number
  selected: boolean
  path: string
  /** `#rrggbb` when the shop named a colour for this value (a swatch). */
  swatch?: string | null
}

export interface FilterGroupView {
  key: string
  label: string
  options: FilterOptionView[]
}

/**
 * "Yalnızca stokta olanlar" (adr/0056): one link that turns `stok=var` on
 * or off (nofollow, D4); its count is what the list holds in stock.
 */
export interface StockFilterView {
  label: string
  count: number
  selected: boolean
  path: string
}

/**
 * The grid/list switch: a plain GET form to the listing (`gorunum=…`),
 * its other parameters carried along, so it works before the script and
 * the address can be shared. Its two buttons say which is on (`aria-pressed`).
 */
export interface ListingViewSwitchView {
  /** "Görünüm": the group's name for a screen reader. */
  label: string
  action: string
  /** The query's parameter (`gorunum`). */
  name: string
  options: { mode: ListingViewMode; value: string; label: string; current: boolean }[]
  /** The listing's other parameters, as hidden fields. */
  keep: { name: string; value: string }[]
}

/** The departure month filter: each month a link that chooses it or lets it go (nofollow). */
export interface DateFilterView {
  label: string
  options: { label: string; path: string; selected: boolean }[]
}

/** The price range form: a plain GET form to the listing, its current filters carried along. */
export interface PriceFilterView {
  action: string
  /** The range the listing's prices span, whole lira. */
  min: number
  max: number
  currentMin: number | null
  currentMax: number | null
  /** The listing's other parameters, as hidden fields. */
  keep: { name: string; value: string }[]
}

/**
 * A category, brand or collection page's own text (adr/0075), drawn at
 * the foot of its first page: after the products and their pages, before
 * the category group's bottom sections. The shop's description as the
 * backend renders its content document, else its plain text.
 */
export interface ListingTextView {
  /**
   * The backend's own HTML from the allow-listed document schema (adr/0019,
   * adr/0075 §2: h2–h4, paragraphs, lists, quotes, tables, bold, italic,
   * safe links): safe to print as it is. Null: show `paragraphs`.
   */
  html: string | null
  /** The plain text in paragraphs while the record has no document; a theme prints them as text. */
  paragraphs: string[]
  /** The shop's one look for these texts (`StoreThemeSettings.listing_text`), every value checked. */
  look: ListingTextSettings
}

export interface ListingPageView {
  title: string
  /**
   * The short intro under the title: a landing page's (its own text as
   * paragraphs). A category, brand or collection gives its text as
   * `footText` instead (adr/0075 §5); a search and the sale page none.
   */
  description: string[]
  /**
   * The page's own text at its foot (adr/0075): a category, brand or
   * collection page's, on its first page only; none or absent: nothing there.
   */
  footText?: ListingTextView | null
  /**
   * The listing's own picture, shown with its title and intro on its
   * first page (a collection's); none: the theme shows no picture.
   */
  image?: ImageView | null
  breadcrumbs: BreadcrumbView[]
  /** Each with its picture when it has one (adr/0046 Ek 2026-11-04). */
  subcategories: CategoryCardView[]
  products: ProductCardView[]
  total: number
  /** The count in words where "N ürün" is not the word (a search's "N sonuç"); absent: "N ürün". */
  countLabel?: string
  /** The filter sheet's button where "N ürünü göster" is not the word ("N tur göster"); absent: it. */
  showResultsLabel?: string
  pagination: PaginationView
  sort: SortOptionView[]
  filters: FilterGroupView[]
  price: PriceFilterView | null
  /** The in-stock toggle; none when the listing does not offer it. */
  stock?: StockFilterView | null
  /** What narrows the list now, each a link that takes it away. */
  active: LinkView[]
  /** Every filter off; null when none is on. */
  clearPath: string | null
  /** The shop's category page sections above the grid (adr/0049), drawn as on the home page. */
  sectionsTop?: HomeSectionView[]
  /** …and below the pages. */
  sectionsBottom?: HomeSectionView[]
  /**
   * A category page's product grid as the design's main section (adr/0049
   * Ek 2026-11-14 §7); absent on other lists and from an older backend: today's.
   */
  main?: CategoryMainView
  /**
   * The products as a grid of cards (`grid`) or one to a row (`list`): the
   * shopper's choice, else the shop's (`StoreThemeSettings.listing_page`).
   * Absent: today's grid.
   */
  layout?: ListingViewMode
  /**
   * Where the trail stands (`StoreThemeSettings.listing_page.crumbs_place`):
   * on the title's line, flush right, from 1024 px (`beside`); not drawn
   * (`none`: the page's `BreadcrumbList` data stays); absent or `above`: on
   * its own line above the title, as today.
   */
  crumbsPlace?: ListingCrumbsPlace
  /** The shopper's grid/list switch beside the sort; none: no switch (today's page). */
  viewSwitch?: ListingViewSwitchView | null
  /**
   * The departure month filter of a shop selling dated products (`ay`,
   * the search box's own parameter, adr/0077 §2); none: not offered.
   */
  dates?: DateFilterView | null
  /** A site search's help (`/arama`); none on other lists. */
  search?: SearchHelpView | null
  /** The empty list's words, when the page has its own (a search, the sale page). */
  empty?: string | null
  /**
   * A site search's search box above its results (adr/0077 §1), its values
   * those asked; none on other lists, and a theme without it draws none.
   */
  searchForm?: SearchFormView | null
  /**
   * Words under the search box while the shop reads sentences (adr/0077
   * §7): a sentence may be written, personal details may not; none: nothing.
   */
  searchHint?: string | null
  /** A search read from the shopper's sentence: what was understood; none: nothing. */
  understood?: UnderstoodView | null
}

/**
 * A search read from the shopper's own sentence (adr/0077 §7): "Anladığım:"
 * and each part read by the shop's names, a link that takes it away (a
 * filter, so nofollow). Built from the filters the server checked, never
 * from what the AI service wrote.
 */
export interface UnderstoodView {
  /** "Anladığım:" */
  title: string
  /** Each part; `remove` names its link for a screen reader ("Filtreyi kaldır: Kapadokya"). */
  parts: (LinkView & { remove: string })[]
}

/** A site search's help (`/arama`, adr/0046 ek 2026-11-03): every item already a link. */
export interface SearchHelpView {
  /** "Bunu mu demek istediniz": phrases the catalogue spells, each its own search. */
  suggestions: LinkView[]
  /**
   * The categories most results are in, at their pages, each with its
   * picture when it has one (adr/0046 Ek 2026-11-05: the shop's own, else
   * its newest product's photo).
   */
  categories: CategoryCardView[]
  /** The brands most results are in, each narrowing this search to it (a filter, nofollow). */
  brands: LinkView[]
  /**
   * The shop's top categories with their pictures, offered where a search
   * found nothing or nothing was asked yet (adr/0046 Ek 2026-11-05); none:
   * the theme offers none.
   */
  popular?: CategoryCardView[]
}

/** A product in the live search's panel: its page, picture and the price its card shows. */
export type SuggestProductView = Pick<ProductCardView, "id" | "title" | "path" | "image" | "price">

/**
 * The header's live search (as the shopper types): the storefront's JSON
 * answer at the theme's `searchSuggest` address, every item already a
 * link, every price formatted on the server.
 */
export interface SearchSuggestView {
  /** The words as searched. */
  q: string
  /** How many products the search finds in all. */
  total: number
  /** `/arama?q=…`: every result. */
  allPath: string
  /** The most relevant few (six at most). */
  products: SuggestProductView[]
  /** The categories most results are in, at their pages. */
  categories: LinkView[]
  /** The brands most results are in, each narrowing the search to it. */
  brands: LinkView[]
  /** "Bunu mu demek istediniz": phrases the catalogue spells, each its own search. */
  suggestions: LinkView[]
}

/** A category in the index (`/kategoriler`): its page, its picture, the categories below it. */
export interface CategoryTreeView extends CategoryCardView {
  children: CategoryTreeView[]
  /** How many products it and the categories below it hold; none: not counted. */
  count?: number | null
}

/** `/kategoriler`: every live category as a tree, in the shop's order. */
export interface CategoriesPageView {
  title: string
  breadcrumbs: BreadcrumbView[]
  categories: CategoryTreeView[]
  /** How many products the shop lists in all; none: not counted. */
  total?: number | null
}

/** A brand in the index (`/markalar`): its page, and its logo when it has one. */
export interface BrandLinkView extends LinkView {
  logo: ImageView | null
}

/** `/markalar`: the shop's brands by first letter, in Turkish alphabetical order. */
export interface BrandsPageView {
  title: string
  breadcrumbs: BreadcrumbView[]
  /** "A", "Ç", "İ"…; names that start with no letter last, under "#". */
  groups: { letter: string; anchor: string; brands: BrandLinkView[] }[]
}
