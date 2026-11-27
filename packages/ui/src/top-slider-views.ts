import type { TopSliderSettings } from "@qticaret/types"
import type { ImageView, LinkView } from "./views"

/**
 * The top image slider as a theme draws it (owner 2026-11-27): a
 * full-width band of the shop's pictures above the header, one at a time.
 * Never empty (no slides: no view). The band holds its height from the
 * first paint; a theme turns it by itself only without reduced motion and
 * stops it on hover, on focus and with a visible pause button (WCAG 2.2.2).
 */
export interface TopSliderView {
  id: string
  slides: TopSlideView[]
  settings: TopSliderSettings
}

export interface TopSlideView {
  /** The wide picture, its words for screen readers the shop's. */
  image: ImageView
  /** A phone's own picture; null: the wide one cropped. */
  mobileImage: ImageView | null
  /** Where the slide leads; null: a picture only. */
  link: LinkView | null
}
