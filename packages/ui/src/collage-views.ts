import type { PhotoCollageSettings } from "@qticaret/types"
import type { ImageView, LinkView } from "./views"

/**
 * The photo collage as a theme draws it (`photo_collage`, adr/0077 §10):
 * three to seven of the shop's photographs in its order, each with its own
 * words (never empty), an optional caption and an optional link (a path).
 * `layout` sets the wide screen's grid (the first large, or all even),
 * `phone` the narrow one's (a swiped row, or one column). The storefront
 * leaves out a collage with no photograph.
 */
export interface PhotoCollageSectionView extends PhotoCollageSettings {
  id: string
  type: "photo_collage"
  /** The section's heading (an h2); null: none, the list named for a screen reader (`label`). */
  title: string | null
  /** The list's name for a screen reader while there is no heading. */
  label: string
  intro: string | null
  items: PhotoCollageItemView[]
  /** A small upper-case line over the heading; absent: none. */
  eyebrow?: string
  /** The link to the whole list beside the heading; absent: none. */
  more?: LinkView
}

export interface PhotoCollageItemView {
  image: ImageView
  caption: string | null
  /** Where the photograph leads; null: nowhere. */
  href: string | null
  /** The `below` card's small line under the name; absent: none. */
  subtitle?: string
}
