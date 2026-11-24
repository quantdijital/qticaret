import "server-only"
import type { StoreHeroFull } from "@qticaret/types"
import { HERO_FULL_LIMITS, heroFullSettingsOf } from "@qticaret/types/section-hero-full"
import type { HeroFullView, SearchFormView, Translate, TrustBadgeView } from "@qticaret/ui"
import { currentShared } from "./layout"
import { EMPTY_VALUES } from "./search-form"
import { currentSearchForm } from "./search-form-data"

/** What the opening reads beside its own fields: the shop's search box and its trust badges. */
export interface HeroFullSource {
  search: SearchFormView | null
  badges: readonly TrustBadgeView[]
}

/**
 * The full image opening's parts from what was read (adr/0077 §9): its
 * settings (one missing or off its list its default), its accent line,
 * the search box only when the opening asks for a search, and at most four
 * of the shop's trust badges only when it shows them.
 */
export function heroFullParts(section: StoreHeroFull, source: HeroFullSource): HeroFullView {
  const settings = heroFullSettingsOf(section)
  const accent = section.title_accent?.trim() ?? ""
  return {
    settings,
    accent: accent === "" ? null : accent,
    search: settings.action === "search" ? source.search : null,
    trust: section.show_trust === true ? source.badges.slice(0, HERO_FULL_LIMITS.trust) : [],
  }
}

/**
 * The full image opening for this request: the shop's one search box
 * (its fields the theme's, adr/0077 §1) and the design's trust badges (a
 * preview shows its draft's), each read only when the opening shows it.
 */
export async function heroFullView(section: StoreHeroFull, t: Translate): Promise<HeroFullView> {
  const { action } = heroFullSettingsOf(section)
  const [search, badges] = await Promise.all([
    action === "search" ? currentSearchForm(EMPTY_VALUES, t) : Promise.resolve(null),
    section.show_trust === true
      ? currentShared().then((shared) => shared.trust_badges)
      : Promise.resolve([]),
  ])
  return heroFullParts(section, { search, badges })
}
