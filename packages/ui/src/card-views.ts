import type { ImageView, LinkView, SpecView } from "./views"

/**
 * Optional view fields a theme may draw (adr/0046 Ek 2026-11-04), shared
 * by every theme: a category's picture, a card's stock and quick add, a
 * review's photos and the stars' spread, the spec table's sections and
 * the footer's marks. Each is optional: a storefront or backend before it
 * leaves it out and the theme draws what it drew before.
 */

/** A category as a card or a mega menu entry shows it: its page, and its picture when it has one. */
export interface CategoryCardView extends LinkView {
  /** The shop's picture for it (media library); none: a theme draws no box. */
  image?: ImageView | null
}

/** What a card says of the product's stock: a bucket, never the number. */
export type StockLevel = "in_stock" | "low" | "out"

/** The one variant a card may put in the cart (single variant, to be had, nothing to ask first). */
export interface QuickAddView {
  variantId: string
}

/** One row of the stars' spread: "5 yıldız — 12", its share of all reviews for the bar. */
export interface RatingBarView {
  stars: 1 | 2 | 3 | 4 | 5
  count: number
  /** 0–100, whole: the bar's fill (a theme maps it to its own width classes, no inline style). */
  percent: number
  /** For a screen reader: "5 yıldız: 12 değerlendirme". */
  label: string
}

/** A photo a customer put on an approved review. */
export interface ReviewPhotoView {
  image: ImageView
}

/** A customer's photo for the home page, with its product and its review's stars. */
export interface CustomerPhotoView {
  image: ImageView
  /** The product it shows, at its page; null when the product has no live page now. */
  product: LinkView | null
  rating: number
  author: string
}

/** A section of the spec table: its name (null for attributes in none), its rows in order. */
export interface SpecGroupView {
  title: string | null
  rows: SpecView[]
}

/** A way to pay or a carrier the footer names: its key (for a theme's own mark) and its name in words. */
export interface ShopMarkView {
  key: string
  label: string
}
