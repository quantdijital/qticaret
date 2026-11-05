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

export interface StoreMediaAsset {
  id: string
  url: string
  width: number | null
  height: number | null
  alt: string | null
  derivatives: MediaDerivatives | null
}

export interface StoreBrand {
  id: string
  name: string
  handle: string
  logo_url: string | null
}

/** `GET /store/brands`: an active brand as a brands page lists it (F3.11). */
export interface StoreBrandSummary extends StoreBrand {
  description: string | null
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

/** A public product attribute (adr/0013): the value sits in its type's column. */
export interface StoreAttributeValue {
  id: string
  value_text: string | null
  value_number: number | string | null
  value_boolean: boolean | null
  /** The chosen option values, for select types. */
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
  } | null
}

/**
 * `GET /store/products/:id/description` (adr/0055): the product's long
 * description as the backend renders its content document (adr/0019's
 * allow-listed HTML); null while the product has only its plain text.
 */
export interface StoreProductDescription {
  html: string | null
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
