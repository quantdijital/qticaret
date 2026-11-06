import type { CategoryCardView } from "./card-views"
import type { HomeSectionView } from "./content-views"
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

export interface ListingPageView {
  title: string
  description: string[]
  breadcrumbs: BreadcrumbView[]
  /** Each with its picture when it has one (adr/0046 Ek 2026-11-04). */
  subcategories: CategoryCardView[]
  products: ProductCardView[]
  total: number
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
  /** A site search's help (`/arama`); none on other lists. */
  search?: SearchHelpView | null
  /** The empty list's words, when the page has its own (a search, the sale page). */
  empty?: string | null
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
