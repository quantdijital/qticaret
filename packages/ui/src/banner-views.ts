import type { BannerSettings, BannerTone } from "@qticaret/types"
import type { ImageView, LinkView } from "./views"

/**
 * The picture band as a theme draws it (adr/0049 Ek 2026-11-14 §3.3 E2):
 * one to six slides in the shop's order, side by side, never sliding by
 * themselves; its steps the ones the contract knows (an unknown one read
 * as the default). A theme keeps the words readable (4.5:1) at every step
 * and tone: with no veil (`overlay: "none"`) it sets them on a plate.
 */
export interface BannerSectionView extends BannerSettings {
  id: string
  type: "banner"
  slides: BannerSlideView[]
}

export interface BannerSlideView {
  image: ImageView
  /** A phone's own picture (under 640 px); null: the wide one. */
  mobileImage: ImageView | null
  heading: string | null
  text: string | null
  /** The main button; null: none. */
  link: LinkView | null
  /** A second button, one step quieter than the first; null: none. */
  secondLink: LinkView | null
  /**
   * The main button is the design's second (its first was broken and left
   * out), for the editor's field mark; absent: each where the design has it.
   */
  secondFirst?: true
  tone: BannerTone
}
