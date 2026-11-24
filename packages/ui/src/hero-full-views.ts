import type { HeroFullSettings, HeroVideoSource } from "@qticaret/types"
import type { HandNoteView } from "./hand-note-views"
import type { SearchFormView } from "./search-form-views"
import type { TrustBadgeView } from "./views"

/**
 * The opening's `full_image` parts as a theme draws them (adr/0077 §9):
 * its settings, each a step the contract knows (a missing one already its
 * default); the heading's second line; the shop's one search box when the
 * opening asks for a search (the same view a `search_box` section and the
 * search page take); and the shop's trust badges when it shows them. The
 * heading, line, buttons and picture are the opening's own, beside this.
 */
export interface HeroFullView {
  settings: HeroFullSettings
  /** The heading's second line, in the shop's colour; null: none. */
  accent: string | null
  /** Set when `settings.action` is `search`; null: the buttons. */
  search: SearchFormView | null
  /** The shop's trust badges, at most four; empty: none shown. */
  trust: TrustBadgeView[]
  /** The video button's video (its host and id only, never the pasted link); null: no button. */
  video: HeroVideoView | null
  /** A short hand note over the heading; null or absent: none (the opening as before it). */
  note?: HandNoteView | null
}

/** The opening's video: whose player and the id there, and the button's own words (null: the theme's). */
export interface HeroVideoView extends HeroVideoSource {
  label: string | null
}
