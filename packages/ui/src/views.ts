/**
 * What a theme is given to show (adr/0046 §7): ready-made view models.
 * The storefront fills them from the Store API; a theme formats nothing
 * but layout, so two themes show the same prices, paths and words.
 */

/** A picture with its versions (adr/0016): one `<source>` per format. */
export interface ImageView {
  src: string
  alt: string
  width: number | null
  height: number | null
  /** `srcset` strings by format, widest last ("…-400.avif 400w, …"). */
  sources: { avif: string | null; webp: string | null }
}

export interface PriceView {
  /** Formatted for the shopper: "1.250,00 TL". */
  current: string
  /** The struck-through price, only when the 30-day rule allows one (F4.3). */
  before: string | null
  /** True when variants differ: the theme says "…'den başlayan". */
  from: boolean
}

export interface LinkView {
  label: string
  path: string
}

export interface NavCategoryView extends LinkView {
  children: LinkView[]
}

export interface ShopView {
  name: string
  logo: ImageView | null
  categories: NavCategoryView[]
  /** The legal pages the shop published (footer). */
  legal: LinkView[]
  cartQuantity: number
}

export interface ProductCardView {
  id: string
  title: string
  path: string
  brand: string | null
  image: ImageView | null
  price: PriceView | null
  available: boolean
}

export interface BreadcrumbView {
  label: string
  /** Null for the current page. */
  path: string | null
}

export interface VariantView {
  id: string
  title: string
  /** Option id → chosen value. */
  options: Record<string, string>
  price: PriceView | null
  available: boolean
  sku: string | null
}

export interface ProductOptionView {
  id: string
  title: string
  values: string[]
}

export interface ProductPageView {
  id: string
  title: string
  subtitle: string | null
  /** Plain text paragraphs; a theme never prints the description as HTML. */
  description: string[]
  brand: LinkView | null
  breadcrumbs: BreadcrumbView[]
  images: ImageView[]
  options: ProductOptionView[]
  variants: VariantView[]
  /** From `?variant=` (docs/13 §2.3), else the first available. */
  selectedVariantId: string | null
}

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

export interface ListingPageView {
  title: string
  description: string[]
  breadcrumbs: BreadcrumbView[]
  subcategories: LinkView[]
  products: ProductCardView[]
  total: number
  pagination: PaginationView
  sort: SortOptionView[]
}

export interface HomePageView {
  /** The shop's own heading for the page; null shows the shop's name. */
  heading: string | null
  categories: LinkView[]
  products: ProductCardView[]
}

export interface ContentPageView {
  title: string
  breadcrumbs: BreadcrumbView[]
  /** The backend's own HTML from its allow-listed schema (adr/0019): safe to print as it is. */
  html: string
  publishedAt: string | null
}

export interface CartLineView {
  id: string
  title: string
  detail: string | null
  quantity: number
  total: string
  image: ImageView | null
}

export interface CartPageView {
  lines: CartLineView[]
  subtotal: string
}
