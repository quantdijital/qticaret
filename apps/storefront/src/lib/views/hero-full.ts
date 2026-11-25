import "server-only"
import type { StoreHeroFull } from "@qticaret/types"
import { heroVideoOf } from "@qticaret/types/hero-video"
import { HERO_FULL_LIMITS, heroFullSettingsOf } from "@qticaret/types/section-hero-full"
import type {
  HeroFullView,
  HeroVideoView,
  SearchFormView,
  Translate,
  TrustBadgeView,
} from "@qticaret/ui"
import { handNoteView } from "./accent"
import { currentShared } from "./layout"
import { EMPTY_VALUES } from "./search-form"
import { currentSearchForm } from "./search-form-data"
import { noteInHand } from "./theme-settings"

/**
 * What the opening reads beside its own fields: the shop's search box, its
 * trust badges, and whether its hand note is drawn in the accent face
 * (absent: not).
 */
export interface HeroFullSource {
  search: SearchFormView | null
  badges: readonly TrustBadgeView[]
  hand?: boolean
}

/**
 * The opening's video: the link's host and id only (the pasted address
 * goes no further than here), with the button's words; none, or a link
 * the parser refuses: no button.
 */
function heroVideo(section: StoreHeroFull): HeroVideoView | null {
  const source = heroVideoOf(section.video_url)
  if (!source) {
    return null
  }
  const label = section.video_label?.trim() ?? ""
  return { host: source.host, id: source.id, label: label === "" ? null : label }
}

/**
 * The full image opening's parts from what was read (adr/0077 §9): its
 * settings (one missing or off its list its default), its accent line,
 * the search box only when the opening asks for a search, at most four
 * of the shop's trust badges only when it shows them, and its video.
 */
export function heroFullParts(section: StoreHeroFull, source: HeroFullSource): HeroFullView {
  const settings = heroFullSettingsOf(section)
  const accent = section.title_accent?.trim() ?? ""
  const note = handNoteView(section.note, source.hand === true)
  return {
    settings,
    accent: accent === "" ? null : accent,
    search: settings.action === "button" ? null : source.search,
    trust: section.show_trust === true ? source.badges.slice(0, HERO_FULL_LIMITS.trust) : [],
    video: heroVideo(section),
    // The hand note only when there is one: an opening without it is the view it was
    ...(note ? { note } : {}),
  }
}

/**
 * The full image opening for this request: the shop's one search box
 * (its fields the theme's, adr/0077 §1) and the design's trust badges (a
 * preview shows its draft's), each read only when the opening shows it.
 */
export async function heroFullView(section: StoreHeroFull, t: Translate): Promise<HeroFullView> {
  const { action } = heroFullSettingsOf(section)
  const [search, badges, hand] = await Promise.all([
    action === "button" ? Promise.resolve(null) : currentSearchForm(EMPTY_VALUES, t),
    section.show_trust === true
      ? currentShared().then((shared) => shared.trust_badges)
      : Promise.resolve([]),
    // The theme's accent face, read only for an opening with a note
    noteInHand(section.note),
  ])
  return heroFullParts(section, { search, badges, hand })
}
