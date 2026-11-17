import type { ImageView } from "./views"

/**
 * A product's video in its gallery (adr/0069 §6, `ProductPageView.videos`):
 * a short clip of ours, or (slice 5) a YouTube video shown as its poster
 * until pressed. Never among the page's `images`: the variants' picture
 * places, the thumbnails and the quick view stay as they are; a theme that
 * does not know videos shows nothing of them.
 */
export interface ProductVideoView {
  id: string
  /** Where it sits: after this many pictures (today always 1). */
  after: number
  /** The shop's title, else the product's name: the player's accessible name. */
  title: string
  poster: ImageView
  width: number | null
  height: number | null
  durationSeconds: number | null
  /** Our clip: sources the theme lists in this order. */
  sources?: { webm: string | null; mp4: string }
  /** A YouTube video: shown as its poster until pressed. */
  youtube?: { embedUrl: string }
}
