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

export interface StoreProduct {
  id: string
  title: string
  handle: string
  subtitle: string | null
  description: string | null
  thumbnail: string | null
  images?: { id: string; url: string; rank?: number | null }[] | null
  options?: StoreProductOption[] | null
  variants?: StoreVariant[] | null
  brand?: StoreBrand | null
  media_assets?: StoreMediaAsset[] | null
}

export interface StoreCategory {
  id: string
  name: string
  handle: string
  description: string | null
  parent_category_id: string | null
  rank?: number | null
}

/** `GET /store/price-display` (F4.3): the 30-day rule's prices, lira strings ("80.00"). */
export interface PriceDisplay {
  current: string
  regular: string
  /** The struck-through price, only when the 30-day rule allows showing one. */
  before: string | null
  on_sale: boolean
  since: string | null
  basis: string
  rule_version: number
}

export interface StoreRegion {
  id: string
  name: string
  currency_code: string
}
