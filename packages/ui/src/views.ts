import type { TrustIcon } from "@qticaret/types"
import type { BottomNavView, ThemeView } from "./frame-views"

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
  /** What the struck-through price saves, formatted ("150,00 TL"); null without one. */
  saving?: string | null
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
  /** When the shop answers, days with the same hours together; none: not said. */
  hours: OpeningHoursView[]
  /** The shop's place on a map (https), when it gave one. */
  mapHref: string | null
}

/** A line of the shop's hours, in words: "Pazartesi – Cuma", "08:00 – 19:00" (or "Kapalı"). */
export interface OpeningHoursView {
  days: string
  hours: string
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
  /** The footer's newsletter box in the shop's words; null: the shop took it out (adr/0049). */
  newsletter: { title: string; text: string } | null
  /** The header's small links (about, contact…). */
  topLinks: LinkView[]
  /** The shop's own columns, or the storefront's (categories, help). */
  footerGroups: FooterGroupView[]
  trustBadges: TrustBadgeView[]
  contact: ContactView
  social: SocialLinkView[]
  /** The registered title for the footer's small print; null shows the shop's name. */
  companyTitle: string | null
  /**
   * The cookie question (D9): open by itself while the visitor has not
   * answered under the policy now, else kept for the footer's "cookie
   * preferences" link to open again. Null when the answer could not be read.
   */
  cookieBanner: CookieBannerView | null
  /** The signed-in customer's first name; null for a guest. */
  customerName: string | null
  /** The shop's published legal texts' pages (D10). */
  legalLinks: LinkView[]
  /** The KVKK notice's page, for the forms that collect an address; null until published. */
  privacyPath: string | null
  /** What the law asks a web shop to show (6563, ETBİS): title, MERSİS, tax, KEP, ETBİS; in words. */
  identityLines: string[]
  /** The shop's theme choices that change markup (adr/0053 §B). */
  theme: ThemeView
  /** The phone's bottom bar; null where it stays away (checkout, a preview). */
  bottomNav: BottomNavView | null
}

export interface CookieBannerView {
  policyVersion: number | null
  /** The cookie policy's page, when the shop published one. */
  policyPath: string | null
  /** No answer yet under the policy now: the banner shows by itself. */
  due: boolean
  /** The answer in force, for the boxes; both false while one is due. */
  analytics: boolean
  marketing: boolean
}

/** `/cerez-tercihleri`: the banner's form on a page of its own, for a browser without script. */
export interface CookiePreferencesPageView {
  title: string
  banner: CookieBannerView
  /** Said once the choice is saved. */
  notice: string | null
}

export interface ProductCardView {
  id: string
  title: string
  path: string
  brand: string | null
  image: ImageView | null
  price: PriceView | null
  available: boolean
  /** The product's reviews in short, when the storefront has them for a card; shown when the shop asks. */
  rating?: CardRatingView | null
}

/** A card's stars: the average and how many reviews, formatted, and in words for a screen reader. */
export interface CardRatingView {
  /** "4,5". */
  average: string
  count: number
  /** "5 üzerinden 4,5 (12 değerlendirme)". */
  label: string
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
  /** Value → `#rrggbb`, for the values the shop named a colour for (a swatch). */
  swatches?: Record<string, string>
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
  /** Approved reviews and the average (F10.6). */
  reviews: ReviewsView
  /** Approved questions with their answers (F10.10). */
  questions: QuestionsView
  /** Other products of its category. */
  related: ProductCardView[]
  /** A WhatsApp chat about this product, its name written in; null without a number. */
  whatsappHref: string | null
  /** The signed-in customer may write; a guest gets the sign-in link instead. */
  signedIn: boolean
  /** Sign in and come back here. */
  loginPath: string
  /** The shop's free shipping line ("1.500,00 TL ve üzeri kargo ücretsiz"), in words; null without one. */
  shippingNote: string | null
  /** The shop's sections below the product's own block (adr/0049), drawn as on the home page. */
  sections?: HomeSectionView[]
}

export interface ReviewView {
  rating: number
  title: string | null
  body: string
  author: string
  /** "1 Kasım 2026". */
  date: string
  verified: boolean
}

export interface ReviewsView {
  average: number | null
  count: number
  items: ReviewView[]
}

export interface QuestionView {
  body: string
  author: string
  date: string
  answers: { body: string; author: string; byShop: boolean }[]
}

export interface QuestionsView {
  count: number
  items: QuestionView[]
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
  /** `#rrggbb` when the shop named a colour for this value (a swatch). */
  swatch?: string | null
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
  /** The categories most results are in, at their pages. */
  categories: LinkView[]
  /** The brands most results are in, each narrowing this search to it (a filter, nofollow). */
  brands: LinkView[]
}

/** A category in the index (`/kategoriler`): its page and the categories below it. */
export interface CategoryTreeView extends LinkView {
  children: CategoryTreeView[]
}

/** `/kategoriler`: every live category as a tree, in the shop's order. */
export interface CategoriesPageView {
  title: string
  breadcrumbs: BreadcrumbView[]
  categories: CategoryTreeView[]
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

/**
 * A section as the theme draws it (adr/0049): the shop lays the home,
 * product and category pages out in the theme editor; every title already
 * in words (the shop's own or the storefront's default, a FAQ's aside),
 * every link already a path.
 */
export type HomeSectionView =
  | {
      id: string
      type: "hero"
      /** A short line above the heading; null: none. */
      eyebrow: string | null
      /** The shop's heading, else its name. */
      heading: string
      intro: string | null
      /** At most two buttons, the first the main one. */
      actions: LinkView[]
      image: ImageView | null
    }
  | {
      id: string
      type: "banner"
      slides: {
        image: ImageView
        heading: string | null
        text: string | null
        link: LinkView | null
      }[]
    }
  | { id: string; type: "categories"; title: string; categories: LinkView[] }
  | {
      id: string
      type: "products"
      title: string
      products: ProductCardView[]
      more: LinkView | null
      /** Words when the rail has nothing to show. */
      empty: string
    }
  | { id: string; type: "brands"; title: string; brands: LinkView[] }
  | { id: string; type: "posts"; title: string; posts: PostCardView[]; more: LinkView }
  | {
      id: string
      type: "reviews"
      title: string
      reviews: (ReviewView & { product: LinkView | null })[]
      more: LinkView
    }
  | { id: string; type: "rich_text"; title: string | null; html: string }
  | { id: string; type: "trust_badges"; badges: TrustBadgeView[] }
  | { id: string; type: "newsletter"; title: string; text: string; privacyPath: string | null }
  | { id: string; type: "help"; title: string; text: string; contact: ContactView }
  | {
      id: string
      type: "faq"
      /** None: the theme's own words ("Sık sorulan sorular"). */
      title: string | null
      /** Plain text; the theme keeps the answers in the HTML (open or closed). */
      items: { question: string; answer: string }[]
    }

export interface HomePageView {
  sections: HomeSectionView[]
  /** A line above the page: a draft's preview says it is one. */
  notice?: string | null
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
  /** The post's category, at its archive (adr/0019 ek 2026-11-03); null when it has none. */
  category?: LinkView | null
}

/** A link in the blog's bar of categories: "all posts" first, then each category. */
export interface BlogTermLinkView extends LinkView {
  /** The page this is (the index, or this category's archive). */
  current: boolean
}

export interface BlogIndexPageView {
  title: string
  breadcrumbs: BreadcrumbView[]
  posts: PostCardView[]
  pagination: PaginationView
  /** The blog's categories with live posts; none: no bar. */
  terms?: BlogTermLinkView[]
  /** On a category's or tag's archive: which, and its own words; null on the index. */
  activeTerm?: { kind: "category" | "tag"; name: string; description: string[] } | null
}

export interface ContentPageView {
  title: string
  breadcrumbs: BreadcrumbView[]
  /** The backend's own HTML from its allow-listed schema (adr/0019): safe to print as it is. */
  html: string
  publishedAt: string | null
  /** The contact form below the text, on the page the shop chose for it (adr/0047). */
  contactForm?: ContactFormView | null
  /** How to reach the shop, from its store details, on that same page (adr/0048). */
  contact?: ContactView | null
  /** A line above the page, in words: a draft's preview says it is one. */
  notice?: string | null
  /** A post's category and tags, at their archives (adr/0019 ek 2026-11-03). */
  category?: LinkView | null
  tags?: LinkView[]
}

/** The storefront's contact form (adr/0047): a signed-in customer's name and address filled in. */
export interface ContactFormView {
  subjects: { value: string; label: string }[]
  name: string | null
  email: string | null
  /** The KVKK notice the form points to; null until the shop publishes one. */
  privacyPath: string | null
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
  /** The gift card codes on the cart, each removable; null while the shop sells none (F4.8). */
  giftCards?: string[] | null
  /** What the gift cards take off, in words; null when none. */
  credit?: string | null
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

/** A page that asks before it acts (a link from an e-mail): the words, the form's hidden fields. */
export interface ConfirmPageView {
  title: string
  text: string
  /** A warning above the button, when acting replaces something. */
  warning: string | null
  fields: { name: string; value: string }[]
  /** The button's words; null when there is nothing left to do (done, or a broken link). */
  submit: string | null
  back: LinkView
}

/** A card family's installment plans (F5): "3 × 428,78 TL", the total, in words. */
export interface InstallmentFamilyView {
  family: string
  options: { count: number; perInstallment: string; total: string }[]
}

export interface ReviewsPageView {
  title: string
  breadcrumbs: BreadcrumbView[]
  average: number | null
  count: number
  reviews: (ReviewView & { product: LinkView | null })[]
  pagination: PaginationView
}
