import type { StripGallerySettings } from "@qticaret/types"
import type { ImageView } from "./views"

/**
 * The strip gallery as a theme draws it (`strip_gallery`, adr/0049 Ek
 * 2026-11-16): two to eight photographs as upright strips with slanted
 * seams across the section, in the shop's order, each already resolved:
 * its picture (the shop's, else its source's), its words (the shop's,
 * else the source's name and line; none while `captions` is off) and its
 * link (the shop's, else the source's page). The storefront leaves out an
 * item with no picture and a section with no item; its steps are the ones
 * the contract knows (an unknown one read as the default).
 */
export interface StripGallerySectionView extends StripGallerySettings {
  id: string
  type: "strip_gallery"
  /** The section's heading (an h2); null: none, the list named for a screen reader. */
  title: string | null
  /** A line under the heading; null: none. */
  text: string | null
  items: StripGalleryItemView[]
}

export interface StripGalleryItemView {
  /** Its place among the design's items, for the editor's field marks (`items.<at>.title`). */
  at: number
  /** Its `alt` empty when the heading drawn over it already names it. */
  image: ImageView
  /** Drawn over the strip's foot; null: none (or `captions` off). */
  title: string | null
  note: string | null
  /** The whole strip a link; null: a plain picture. */
  href: string | null
}
