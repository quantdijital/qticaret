import type { AddonFieldView } from "./addon-views"
import type { BookingView, CardBookingView } from "./booking-views"
import type { ProductMainView } from "./main-views"
import type {
  QuickAddView,
  RatingBarView,
  ReviewPhotoView,
  ShopMarkView,
  SpecGroupView,
  StockLevel,
} from "./card-views"
import type { InstallmentSummaryView } from "./cart-views"
import type { CardVariant } from "./section-variants"
import type {
  CardButtonStyle,
  CardNoReviews,
  CardQuickViewTrigger,
  CardSoldOutRow,
} from "@qticaret/types"
import type { HomeSectionView } from "./content-views"
import type { ProductVideoView } from "./video-views"
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
  /** The product's subtitle, on a split card only (`look.split`); none elsewhere. */
  subtitle?: string | null
  image: ImageView | null
  /**
   * The product's second photo, on every variant while the shop has
   * `hover_image` on (sahip 2026-11-18): shown over the first on hover or
   * focus, swiped to on a touch screen where the card is large enough.
   * Loaded lazily, never with the first paint. None: one photo, or the shop
   * turned it off.
   */
  secondImage?: ImageView | null
  /**
   * The product's photos after the second, in its order, while the shop has
   * `hover_cycle` on (sahip 2026-11-26): with a mouse resting on the card
   * they follow the second in turn. Never on a touch screen, nor for a
   * shopper who asks for less motion; each loaded only just before its
   * turn. None: today's second photo alone.
   */
  morePhotos?: readonly ImageView[]
  price: PriceView | null
  available: boolean
  /** The product's reviews in short, when the storefront has them for a card; shown when the shop asks. */
  rating?: CardRatingView | null
  /** Its stock as a bucket (adr/0046 Ek 2026-11-04): "few left" on `low`; never the number. */
  stock?: StockLevel
  /** Put in the cart from the card (`addToCart` with this variant, quantity 1); none: its page first. */
  quickAdd?: QuickAddView | null
  /**
   * How the card is drawn (adr/0049 Ek 2026-11-14 §3.3): the theme
   * setting's, or its rail's own; none: `standard`. A theme draws one it
   * does not know as `standard` and leaves `framed` unread.
   */
  variant?: CardVariant
  /** What only a framed card shows (UK5 + E5); present with `variant: "framed"`. */
  framed?: FramedCardView
  /**
   * What the shop set every card to show (adr/0049 Ek 2026-11-15): its
   * pills, a sold-out card's price row, the stars' place without reviews.
   * None: today's card (`CARD_SHOWN_DEFAULTS`).
   */
  shown?: CardShownView
  /** The quick view button's look while the shop has it on (adr/0049 Ek 2026-11-15); none: no button. */
  quickView?: CardQuickViewTrigger
  /**
   * A dated product's (adr/0076 §10): its price is "…'den itibaren" and
   * the nearest departure goes under it. None: any other product's card.
   */
  booking?: CardBookingView
  /**
   * The card's look as the shop set it (adr/0077 Ek "tur kartı"); none:
   * today's card. A theme without it draws today's.
   */
  look?: CardLookView
  /**
   * The one small badge on the photo while the shop has one on: the
   * product's own line ("Sınırlı"), "Çok satan" or "Yeni", its words
   * already said. None: today's card, not a mark more.
   */
  badge?: CardBadgeView | null
}

/** A card's badge (`ProductCardView.badge`): its words and which kind, for a theme's colour. */
export interface CardBadgeView {
  text: string
  kind: "manual" | "new" | "best_seller"
}

/**
 * A card's look beyond today's (adr/0077 Ek "tur kartı"), each off on
 * today's card. `over` and `arrow` are the standard card's; `duration`
 * and `perPerson` draw only on a dated card (`booking`).
 */
export interface CardLookView {
  /** The name, a line and the price over a dark fade at the photo's foot, the price at the right. */
  over: boolean
  /**
   * Over the photo, the name and its subtitle at the left and a short price in
   * the accent colour at the right, no rows (`text_position: over_split`). Absent: false.
   */
  split?: boolean
  /** The stars' average as a pill on the photo ("★ 4,8") instead of the stars' row. */
  ratingBadge: boolean
  /** A round arrow at the card's foot, for the eye only: the card keeps its one link. */
  arrow: boolean
  /** A dated card's length row (`booking.duration`). */
  duration: boolean
  /** "kişi başı" after a dated card's price. */
  perPerson: boolean
  /**
   * A standard card's compact rows (`density: compact`, sahip 2026-11-26):
   * the price right under the name, then the stars with their count and a
   * dated card's length on one line; over the photo, the stars' pill
   * carries the count and the length. Absent: false.
   */
  compact?: boolean
}

/** A card's pills and rows as the shop set them, on every variant (adr/0049 Ek 2026-11-15). */
export interface CardShownView {
  /** The discount pill ("%30"). */
  saleBadge: boolean
  /** "Az kaldı" on a low stock bucket. */
  lowStockBadge: boolean
  /** "Tükendi" on the photo. */
  soldOutBadge: boolean
  /** A sold-out card's price row: the price, "Tükendi", or "Gelince haber ver" to its page's stock alert. */
  soldOutRow: CardSoldOutRow
  /**
   * A product without reviews, the stars shown: nothing, empty stars and
   * "Henüz yorum yok", or "İlk yorumu sen yaz" to its page's reviews. Only
   * `hide` when the storefront does not know its reviews.
   */
  noReviews: CardNoReviews
}

/** A framed card's own (adr/0049 Ek 2026-11-14 §3.3, E5), each as the shop set it. */
export interface FramedCardView {
  /** "Ücretsiz kargo" under the price: a shipped product whose lowest price reaches the threshold. */
  freeShipping: boolean
  /** The add button across the card's foot ("Sepete ekle", or "Seçenekler" to its page). */
  fullButton: boolean
  /** That button's look: filled, the quiet bordered one (today's), or an underlined word. */
  buttonStyle: CardButtonStyle
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
  /**
   * Its own pictures (Medusa's variant images) as places in the page's
   * `images`, in their order: chosen, a theme shows them first and the
   * pictures tied to no variant after them. None or empty: none of its
   * own (a theme keeps the pictures it shows).
   */
  images?: number[]
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
  /**
   * The shop's short description as it wrote it (adr/0055 Ek 2026-11-06):
   * the backend's own HTML of its document, from the description's
   * allow-list held to the short slot (paragraphs, line breaks, h3–h4,
   * lists, bold, italic, links): safe to print as it is. Shown under the
   * title, subtitle and rating, above the price, in the body's size.
   * Left out or null: none, and the theme shows the headline facts
   * (`specs` with `highlight`) there instead.
   */
  summaryHtml?: string | null
  brand: LinkView | null
  breadcrumbs: BreadcrumbView[]
  images: ImageView[]
  /** The product's videos (adr/0069), in gallery order; none: no videos. */
  videos?: ProductVideoView[]
  options: ProductOptionView[]
  variants: VariantView[]
  /** From `?variant=` (docs/13 §2.3), else the first available. */
  selectedVariantId: string | null
  /**
   * The variant `?variant=` asked for when it has pictures of its own:
   * the gallery opens on them. None: the product's pictures in their order.
   */
  galleryVariantId?: string | null
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
   * "Kargo ve Teslimat" beside the description and the specs (owner
   * 2026-11-05): a shipped product's delivery and return facts from the
   * shop's settings and its own promises, its carriers and the pages that
   * say more. Null or left out: the product is not shipped (digital,
   * service, gift card), the buy column keeps the facts.
   */
  shipping?: ProductShippingView | null
  /**
   * The product is not shipped (a dated product, a service, a download, a
   * gift card): its page's own headings say nothing of a parcel ("Açıklama",
   * "Güvenceler", "Bunlara da göz atın"). Absent or false: today's words.
   */
  unshipped?: boolean
  /**
   * A physical product the shop marked as a sealed hygiene good, in words
   * near the cart form: its right of withdrawal ends once the seal is
   * opened, told before the purchase (MSY md. 5/1-h, 6/2, 15/1-ç).
   * Null or left out: no such mark.
   */
  withdrawalNote?: string | null
  /** The shop's sections below the product's own block (adr/0049), drawn as on the home page. */
  sections?: HomeSectionView[]
  /** The product's own block as the design's main section (adr/0049 Ek 2026-11-14 §7); absent: today's. */
  main?: ProductMainView
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
  /**
   * A dated product (adr/0076 §10): its departures and price categories,
   * picked in place of the options and "add to cart" (`addBookingToCart`).
   * Absent or null: any other product, drawn as before. A feature of the
   * main block, not a variant of it (adr/0066 K3(b), K4).
   */
  booking?: BookingView | null
  /**
   * A line above the page saying what is shown: a draft product's signed
   * preview (F18), as a content page's. Null or left out: none.
   */
  notice?: string | null
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
  /**
   * The shop's public reply under it: its words, the shop's name, when.
   * Text only; a reply is not a review and goes into no structured data.
   */
  reply?: ReviewReplyView | null
}

export interface ReviewReplyView {
  text: string
  /** The shop's name. */
  author: string
  /** "3 Kasım 2026" and its machine form. */
  date: { label: string; dateTime: string }
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

/** A shipped product's delivery and returns, in words; nothing is promised the shop did not set. */
export interface ProductShippingView {
  /**
   * The facts in order, each with its icon: free shipping from the shop's
   * threshold, when an order leaves and arrives and the same-day hour from
   * its settings (adr/0046 Ek 2026-11-06; else its own shipping promises),
   * the return window. The shop's delivery and return promises are not
   * repeated in the buy column.
   */
  facts: TrustBadgeView[]
  /** The carriers whose contract the shop connected, their own marks. */
  carriers: ShopMarkView[]
  /** The shop's shipping page and its return policy, those it published. */
  links: LinkView[]
}

/** One attribute as a shopper reads it: "Bıçak uzunluğu" — "21 cm". */
export interface SpecView {
  label: string
  value: string
  /** The shop marked it as a headline fact (shown under the title too). */
  highlight: boolean
}
