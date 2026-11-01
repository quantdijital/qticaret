import type { TrustIcon } from "@qticaret/types"

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
  /** Whole percent off the struck-through price ("%25"); null without one. */
  discount: number | null
}

export interface LinkView {
  label: string
  /** A path on the shop, or an https address the shop linked to. */
  path: string
}

export interface NavCategoryView extends LinkView {
  children: LinkView[]
}

/** A promise in the trust strip (D3): an icon name, a title and a line. */
export interface TrustBadgeView {
  icon: TrustIcon
  title: string
  text: string | null
}

export interface FooterGroupView {
  title: string
  links: LinkView[]
}

export interface ContactView {
  email: string | null
  /** For reading: "0532 123 45 67". */
  phone: string | null
  /** `tel:+905321234567`. */
  phoneHref: string | null
  /** `https://wa.me/905321234567`, when the shop gave a WhatsApp number. */
  whatsappHref: string | null
  address: string | null
}

export interface SocialLinkView {
  /** The network's name ("Instagram"), or the address's host. */
  label: string
  href: string
}

/** The cart as the header's drawer shows it (D6): its lines read-only, the subtotal. */
export interface MiniCartView {
  lines: CartLineView[]
  subtotal: string
  freeShipping: FreeShippingView | null
}

/** Everything the frame around every page shows (D3, docs/19 §4). */
export interface ShopView {
  name: string
  logo: ImageView | null
  categories: NavCategoryView[]
  cartQuantity: number
  /** The open cart's lines for the drawer; null without one. */
  cart: MiniCartView | null
  /** The announcement bar's lines; none: no bar. */
  announcements: string[]
  /** The header's small links (about, contact…). */
  topLinks: LinkView[]
  /** The shop's own columns, or the storefront's (categories, help). */
  footerGroups: FooterGroupView[]
  trustBadges: TrustBadgeView[]
  contact: ContactView
  social: SocialLinkView[]
  /** The registered title for the footer's small print; null shows the shop's name. */
  companyTitle: string | null
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
  /** The product's public attributes, in the shop's order, ready to read. */
  specs: SpecView[]
  /** The shop's promises (shipping, returns…), beside the cart form. */
  trustBadges: TrustBadgeView[]
}

/** One attribute as a shopper reads it: "Bıçak uzunluğu" — "21 cm". */
export interface SpecView {
  label: string
  value: string
  /** The shop marked it as a headline fact (shown under the title too). */
  highlight: boolean
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

/** One value of a filter: a link that chooses it or lets it go (nofollow, D4). */
export interface FilterOptionView {
  label: string
  count: number
  selected: boolean
  path: string
}

export interface FilterGroupView {
  key: string
  label: string
  options: FilterOptionView[]
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
  subcategories: LinkView[]
  products: ProductCardView[]
  total: number
  pagination: PaginationView
  sort: SortOptionView[]
  filters: FilterGroupView[]
  price: PriceFilterView | null
  /** What narrows the list now, each a link that takes it away. */
  active: LinkView[]
  /** Every filter off; null when none is on. */
  clearPath: string | null
}

export interface HomePageView {
  /** A short line above the heading; null: none. */
  eyebrow: string | null
  /** The page's heading: the shop's own, else its name. */
  heading: string
  /** The shop's own words under it; null: none. */
  intro: string | null
  /** The opening's buttons (at most two), the first the main one. */
  actions: LinkView[]
  categories: LinkView[]
  products: ProductCardView[]
  /** The newest blog posts (at most three); none: no blog block. */
  posts: PostCardView[]
  /** How to reach the shop, for the "ask us" band; null without a phone, WhatsApp or e-mail. */
  help: ContactView | null
}

export interface PostCardView {
  title: string
  path: string
  excerpt: string
  image: ImageView | null
  /** "1 Kasım 2026", already in words; null for an undated post. */
  date: string | null
  /** The machine form for `<time datetime>`. */
  dateTime: string | null
  /** "5 dk okuma", already in words. */
  reading: string
}

export interface BlogIndexPageView {
  title: string
  breadcrumbs: BreadcrumbView[]
  posts: PostCardView[]
  pagination: PaginationView
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
  /** The line before its discount, only when one applies. */
  original: string | null
  image: ImageView | null
}

export interface CartPageView {
  lines: CartLineView[]
  /** Items before discounts; the discount only when there is one. */
  items: string
  discount: string | null
  subtotal: string
  /** The coupon codes on the cart, each removable. */
  promotions: string[]
  /** How near the cart is to free shipping; null when the shop gives none. */
  freeShipping: FreeShippingView | null
  /** A message for the shopper after a failed change, already in words. */
  error: string | null
}

export interface FreeShippingView {
  /** "Ücretsiz kargo için 250,00 TL daha ekleyin" or "Kargo ücretsiz", in words. */
  message: string
  /** 0–100, the bar's fill. */
  percent: number
  reached: boolean
}
