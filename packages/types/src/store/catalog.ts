/**
 * The catalog fields the storefront asks the Store API for (adr/0046 §8):
 * Medusa's own product, variant and category answers narrowed to what a
 * theme shows, plus our relations (`brand`, `media_assets`).
 */

/** A product image's versions (adr/0016): WebP and AVIF widths, a share crop. */
export interface MediaDerivatives {
  srcset?: { webp?: { width: number; url: string }[]; avif?: { width: number; url: string }[] }
  og?: { url: string; width: number; height: number }
}

/**
 * A picture in a text (a page, a post, a product's description) as the
 * media library knows it: the storefront prints its size and `srcset` on
 * the `<img>` with this address (docs/21 2026-11-06).
 */
export interface StoreBodyImage {
  url: string
  width: number | null
  height: number | null
  derivatives: MediaDerivatives | null
}

export interface StoreMediaAsset {
  id: string
  url: string
  width: number | null
  height: number | null
  alt: string | null
  derivatives: MediaDerivatives | null
}

/**
 * A product's video as the Store API gives it (adr/0069 §6, its leaves one
 * by one): the backend sends only the ready ones, and none while
 * `catalog.product_videos` is off. Addresses are public storage URLs.
 */
export interface StoreMediaVideo {
  id: string
  kind: "upload" | "youtube"
  status: "uploaded" | "processing" | "ready" | "failed"
  title: string | null
  /** After this many pictures (today always 1). */
  position: number | null
  width: number | null
  height: number | null
  duration_ms: number | null
  outputs: {
    mp4?: { url: string; bytes?: number } | null
    webm?: { url: string; bytes?: number } | null
  } | null
  poster: {
    url: string
    width: number | null
    height: number | null
    derivatives: MediaDerivatives | null
  } | null
  youtube_id: string | null
}

export interface StoreBrand {
  id: string
  name: string
  handle: string
  logo_url: string | null
  /**
   * The logo's size in pixels, read on the server when it was set; null
   * when unknown, absent where the answer leaves it out (a product's
   * brand). With both, a theme saves the logo's room before it loads.
   */
  logo_width?: number | null
  logo_height?: number | null
}

/** The longest logo side the backend keeps (`LOGO_SIDE_MAX` there): keep the two the same. */
export const BRAND_LOGO_SIDE_MAX = 65_535

const isSide = (value: unknown): value is number =>
  typeof value === "number" && Number.isInteger(value) && value > 0 && value <= BRAND_LOGO_SIDE_MAX

/**
 * A brand logo's size when the answer gives both sides as whole pixels,
 * else null (unknown, absent, or something no theme can draw by): a
 * theme then draws the logo as it did before sizes were kept.
 */
export function brandLogoSize(
  brand: Pick<StoreBrand, "logo_width" | "logo_height">
): { width: number; height: number } | null {
  const { logo_width: width, logo_height: height } = brand
  return isSide(width) && isSide(height) ? { width, height } : null
}

/** Medusa's calculated price: amounts in lira as numbers, KDV included. */
export interface StoreCalculatedPrice {
  calculated_amount: number | null
  original_amount: number | null
  currency_code: string
}

export interface StoreVariant {
  id: string
  title: string | null
  sku: string | null
  manage_inventory: boolean | null
  allow_backorder: boolean | null
  inventory_quantity?: number | null
  options?: { id: string; value: string; option_id?: string | null }[] | null
  calculated_price?: StoreCalculatedPrice | null
}

export interface StoreProductOption {
  id: string
  title: string
  values?: { id: string; value: string }[] | null
}

/** A section of a template's spec table (adr/0013 Ek 2026-11-04): a definition names it by `key`. */
export interface StoreAttributeGroup {
  key: string
  name: string
  rank: number
}

/**
 * A public product attribute (adr/0013): the value sits in its type's
 * column. A `text` and a `select` (the chosen option's value) in
 * `value_text`, a `multi_select` in `value_options`.
 */
export interface StoreAttributeValue {
  id: string
  value_text: string | null
  value_number: number | string | null
  value_boolean: boolean | null
  /** The chosen options' values of a `multi_select`; a `select` has null here. */
  value_options: string[] | null
  definition: {
    key: string
    label: string
    type: "text" | "number" | "boolean" | "select" | "multi_select"
    unit: string | null
    rank: number
    options: { value: string; label: string }[] | null
    is_seo_highlight: boolean
    /** Its spec table section's key, when asked (`definition.group`); null: none. */
    group?: string | null
    /** Its template's sections, when asked (`definition.template.groups`); null: one table. */
    template?: { groups: StoreAttributeGroup[] | null } | null
  }
}

/**
 * An image of the shop's media library as a Store answer gives it (a
 * category's picture, the ETBİS QR code): its size and versions where the
 * library knows them.
 */
export interface StoreImage {
  url: string
  alt: string | null
  width: number | null
  height: number | null
  derivatives: MediaDerivatives | null
}

/**
 * `GET /store/collections/:id/details`: what a shown collection's page
 * carries beyond Medusa's title (Ürünler > Koleksiyonlar). A hidden one
 * answers 404.
 */
export interface StoreCollectionDetails {
  /** Plain paragraphs, a blank line between them; null: none. */
  description: string | null
  /**
   * The text as the shop formatted it (adr/0075), rendered on the server
   * from its content document, for the foot of the page; null: plain text
   * only (`description`). Absent from a backend before it: null.
   */
  description_html?: string | null
  image: StoreImage | null
}

/**
 * `GET /store/category-descriptions/:id` (adr/0075): a live category's
 * text as the shop formatted it, rendered on the server, for the foot of
 * its page; null: plain text only (Medusa's `description`).
 */
export interface StoreCategoryDescription {
  category_id: string
  description_html: string | null
}

/** `GET /store/category-images` (adr/0046 Ek 2026-11-04): a live category's picture. */
export interface StoreCategoryImage extends StoreImage {
  category_id: string
}

/** What a card says of its stock (adr/0046 Ek 2026-11-04): a bucket, never the number. */
export type StoreStockBucket = "in_stock" | "low" | "out"

/** `GET /store/card-facts?id=`: a published product's card facts, by product id. */
export interface StoreCardFacts {
  stock: StoreStockBucket
  /** The one variant a card may put in the cart; null: the product's page first. */
  quick_add: { variant_id: string } | null
  /**
   * Its approved reviews in short (adr/0062): the average to one decimal
   * and how many; null without one. Absent from a backend before it.
   */
  rating?: { average: number; count: number } | null
  /**
   * A dated product's (adr/0076 §10), only while the shop sells them: the
   * lowest paying price over the departures on sale (else the base
   * prices) in the currency's amount, and the nearest departure on sale
   * (ISO; said in `timezone`); each null when there is none.
   */
  booking?: {
    from_price: number | null
    currency_code: string
    next_departure: string | null
    timezone: string
    /**
     * Only when the card was asked for a date search's dates (adr/0077
     * §4): the places left on `next_departure` (null without one), and
     * `in_range`: the departure and the from price are those inside the
     * dates asked. Absent otherwise, and from a backend before it.
     */
    left?: number | null
    in_range?: true
    /**
     * Its length in whole days, from its public tour length attribute (a
     * sector pack's "Süre", adr/0077 Ek "tur kartı"); absent without one,
     * and from a backend before it.
     */
    duration_days?: number
  }
}

/**
 * `GET /store/departures/calendar?month=YYYY-MM[&kategori=][&kisi=]`
 * (adr/0077 §6), only while the shop sells dated products: each local day
 * of the month (the product's zone) with a departure a date search would
 * match, how many, and the lowest paying price over them (a guest's, in
 * lira as the card's `from_price`: 1750.5; each departure's difference
 * added; null when none has a price). Lira only. Days without one are
 * left out.
 */
export interface StoreDepartureCalendar {
  month: string
  currency: "try"
  days: { date: string; from_price: number | null; departures: number }[]
}

export interface StoreProduct {
  id: string
  title: string
  handle: string
  /** Asked on the product page: its neighbours come from its first category. */
  categories?: { id: string }[] | null
  subtitle: string | null
  description: string | null
  thumbnail: string | null
  images?:
    | {
        id: string
        url: string
        rank?: number | null
        /** The variants it shows with (Medusa's variant images); none: every variant. */
        variants?: ({ id: string } | null)[] | null
      }[]
    | null
  options?: StoreProductOption[] | null
  variants?: StoreVariant[] | null
  brand?: StoreBrand | null
  media_assets?: StoreMediaAsset[] | null
  /** Asked on the product page (adr/0069): its ready videos; none while the flag is off. */
  media_videos?: StoreMediaVideo[] | null
  attribute_values?: StoreAttributeValue[] | null
  /**
   * The catalog's own row; the Store API answers only its gift card mark
   * (adr/0025 Ek 2026-11-03). `withdrawal_excluded` and `kind` (a physical
   * product's sealed hygiene mark, adr/0052 Ek 2026-11-03) are read once
   * the backend lets them be asked; today it refuses them.
   */
  product_extension?: {
    is_gift_card?: boolean | null
    withdrawal_excluded?: boolean | null
    kind?: string | null
    /**
     * `departure`: a dated product (adr/0076 §2), bought through its
     * departures (`/store/products/:id/booking`), never "add to cart". On
     * the product's own answer only (`+product_extension.booking_mode`).
     */
    booking_mode?: string | null
    /**
     * The shop's short description as a content document (adr/0055 Ek
     * 2026-11-06), with `+product_extension.summary_doc`, on the product's
     * own answer only. The storefront prints the backend's HTML of it
     * (`StoreProductDescription.summary_html`) instead.
     */
    summary_doc?: Record<string, unknown> | null
  } | null
}

/**
 * `GET /store/products/:id/description` (adr/0055): the product's long
 * description as the backend renders its content document (adr/0019's
 * allow-listed HTML); null while the product has only its plain text.
 */
export interface StoreProductDescription {
  html: string | null
  /** Its short description's HTML (adr/0055 Ek 2026-11-06); null without one. */
  summary_html: string | null
  /** The library pictures of both texts, with their size and versions. */
  images?: StoreBodyImage[]
}

export interface StoreCategory {
  id: string
  name: string
  handle: string
  description: string | null
  parent_category_id: string | null
  rank?: number | null
}

/**
 * `GET /store/price-display` (F4.3): the price-before rule's prices, lira
 * strings ("80.00"). `current` is what the shopper pays, an automatic
 * promotion every shopper gets included (adr/0023 Ek 2026-11-05).
 */
export interface PriceDisplay {
  current: string
  regular: string
  /** The struck-through price, only when the price-before rule allows showing one. */
  before: string | null
  on_sale: boolean
  since: string | null
  basis: string | null
  /** The rule's reading in force ("tr-10d-1"). */
  rule_version: string
  /** An automatic promotion the cart applies past a minimum; absent from a backend before it. */
  cart_offer?: StoreCartOffer | null
  /**
   * A signed-in wholesaler's display (ADR-0068 §7), made by the
   * storefront's server from `/store/customers/me/wholesale-prices`, never
   * by the public `/store/price-display`: `current` is then without KDV.
   * Absent: the public display, KDV included.
   */
  vat_exclusive?: boolean
  /** With `vat_exclusive`: what the wholesaler pays, KDV included, lira ("80.00"). */
  gross?: string
}

/** A cart offer to name beside a price: "Sepette %10 indirim", "2.000 TL ve üzeri sepette…". */
export interface StoreCartOffer {
  type: "percentage" | "fixed"
  /** A percentage as a number (10); an amount as lira ("50.00"). */
  value: number | string
  /** The least the cart must hold, lira; null: none. */
  minimum: string | null
}

export interface StoreRegion {
  id: string
  name: string
  currency_code: string
}
