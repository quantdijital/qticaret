import type { AddonFieldView } from "./addon-views"
import type {
  QuickAddView,
  RatingBarView,
  ReviewPhotoView,
  SpecGroupView,
  StockLevel,
} from "./card-views"
import type { InstallmentSummaryView } from "./cart-views"
import type { HomeSectionView } from "./content-views"
import type { ImageView, LinkView, PriceView, TrustBadgeView } from "./views"

/**
 * A product as a theme shows it (adr/0046 §7): its card, its page, its
 * reviews, questions and specs.
 */

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
  /** Its stock as a bucket (adr/0046 Ek 2026-11-04): "few left" on `low`; never the number. */
  stock?: StockLevel
  /** Put in the cart from the card (`addToCart` with this variant, quantity 1); none: its page first. */
  quickAdd?: QuickAddView | null
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
  /** The price in kuruş, only for the add-ons' running total (adr/0052); null without a price. */
  kurus?: number | null
  available: boolean
  sku: string | null
  /**
   * Its installments in one line, for a variant to be had; none or null:
   * the shop offers none for this price (no line, no table to open). The
   * table itself is asked when the shopper opens it (`installments`).
   */
  installments?: InstallmentSummaryView | null
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
  /**
   * The plain text description in paragraphs: what the page shows while
   * the product has no content document (`descriptionHtml` null). A theme
   * never prints this as HTML.
   */
  description: string[]
  /**
   * The product's content document (adr/0055) as the backend's own HTML
   * from its allow-listed schema (adr/0019: headings, paragraphs, lists,
   * quotes, tables): safe to print as it is. Null: show `description`.
   */
  descriptionHtml: string | null
  brand: LinkView | null
  breadcrumbs: BreadcrumbView[]
  images: ImageView[]
  options: ProductOptionView[]
  variants: VariantView[]
  /** From `?variant=` (docs/13 §2.3), else the first available. */
  selectedVariantId: string | null
  /** The product's public attributes, in the shop's order, ready to read. */
  specs: SpecView[]
  /**
   * The same attributes in the template's sections (adr/0013 Ek
   * 2026-11-04), in the sections' order; without sections one group whose
   * title is null holds them all. None: no attributes.
   */
  specGroups?: SpecGroupView[]
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
  /**
   * A physical product the shop marked as a sealed hygiene good, in words
   * near the cart form: its right of withdrawal ends once the seal is
   * opened, told before the purchase (MSY md. 5/1-h, 6/2, 15/1-ç).
   * Null or left out: no such mark.
   */
  withdrawalNote?: string | null
  /** The shop's sections below the product's own block (adr/0049), drawn as on the home page. */
  sections?: HomeSectionView[]
  /**
   * A gift card the shop sells (adr/0025 Ek 2026-11-03): the amount is the
   * variant, and the cart form asks who the card is for.
   */
  giftCard?: boolean
  /**
   * The product's add-ons (adr/0052), asked in the cart form above "add
   * to cart"; none while the shop has them off or the product has none.
   */
  addons?: AddonFieldView[]
}

export interface ReviewView {
  rating: number
  title: string | null
  body: string
  author: string
  /** "1 Kasım 2026". */
  date: string
  verified: boolean
  /** The photos the customer put on it, in their order (adr/0037 §4 Ek 2026-11-04). */
  photos?: ReviewPhotoView[]
}

export interface ReviewsView {
  average: number | null
  count: number
  items: ReviewView[]
  /** How many gave each number of stars, 5 to 1 (adr/0046 Ek 2026-11-04); none without reviews. */
  distribution?: RatingBarView[] | null
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
