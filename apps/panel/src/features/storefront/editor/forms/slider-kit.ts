import {
  HERO_CATALOG_SLIDER_DEFAULTS,
  SCROLLER_DEFAULTS,
  SLIDER_DEFAULTS,
  SLIDER_SCROLLER,
  sliderSettingsOf,
} from "@qticaret/types"
import type { ScrollerSettings, SliderSettings } from "@qticaret/types"
import type { AnySection, HeroSection, HeroSliderSection } from "@/features/storefront/api/layout"
import { SLIDER_LOOK, SLIDER_MAIN, SLIDER_OTHER, scrollerOffers } from "./scroller-groups"
import { SHELF_IDS } from "./shelf-registry"

/** H17's opening (`category_list`), whose slides turn on the slider's settings (adr/0049 Ek 2026-11-15). */
export type CatalogHero = Extract<HeroSection, { variant: "category_list" }>

/** A section that turns on the slider's settings: the sliding opening, or H17 with slides. */
export type KitSection = HeroSliderSection | CatalogHero

/**
 * Whether the section turns on the slider's settings now: the sliding
 * opening always; H17 only with two or more slides (one never moves, so
 * the panel offers nothing for it; bilesen-standardi §0 ilke 3).
 */
export const turnsAsSlider = (section: AnySection): section is KitSection =>
  section.type === "hero_slider" ||
  (section.type === "hero" &&
    section.variant === "category_list" &&
    (section.slides?.length ?? 0) > 1)

/** The section's own defaults: the sliding opening still, H17's slides turning by themselves. */
export const kitDefaultsOf = (section: KitSection): SliderSettings =>
  section.type === "hero" ? HERO_CATALOG_SLIDER_DEFAULTS : SLIDER_DEFAULTS

/** The section's slider settings as a reader takes them (a step missing: its own default). */
export const kitSettingsOf = (section: KitSection): SliderSettings =>
  sliderSettingsOf(section, kitDefaultsOf(section))

/** The slider's kit settings as the kit's fields take them (the ones it has no use for at their defaults). */
export const asKit = (section: KitSection): ScrollerSettings => ({
  ...SCROLLER_DEFAULTS,
  ...kitSettingsOf(section),
})

/**
 * The section with the kit's fields' answer (bilesen-denetimi (b) 4): only
 * the settings it has use for kept; for the sliding opening the switches
 * from before the kit dropped, and seconds saved before the kit dropped
 * once the shop picks another speed.
 */
export function withSliderKit(section: KitSection, next: ScrollerSettings): KitSection {
  const scroller = Object.fromEntries(
    SLIDER_SCROLLER.map((name) => [name, next[name]])
  ) as SliderSettings
  if (section.type === "hero") {
    return { ...section, scroller }
  }
  const keep = scroller.speed === sliderSettingsOf(section).speed
  const out: HeroSliderSection = { ...section, scroller }
  delete out.autoplay
  delete out.dots
  delete out.arrows
  if (!keep) {
    delete out.interval
  }
  return out
}

/** How many of the section's closed kit settings are off its own default. */
export const sliderOtherCount = (section: KitSection): number => {
  const settings = kitSettingsOf(section)
  const defaults = kitDefaultsOf(section)
  return SLIDER_OTHER.filter((name) => settings[name] !== defaults[name]).length
}

/**
 * A slider control the live preview named (adr/0065 Faz 2b): the theme
 * marks the arrows `scroller.arrows`, the dots `scroller.dots` and the
 * pause button `scroller.play_button`. Its kit field and the group it
 * stands in; null for a setting the section does not offer as it stands.
 */
export function sliderControlField(
  section: KitSection,
  parts: readonly string[]
): { target: string; group: "scroll" | "controls" } | null {
  const [first, setting, ...rest] = parts
  const name = SLIDER_SCROLLER.find((each) => each === setting)
  if (first !== "scroller" || rest.length > 0 || !name || !scrollerOffers(asKit(section), name)) {
    return null
  }
  if (SLIDER_MAIN.includes(name)) {
    return { target: SHELF_IDS.scroller(section.id, name), group: "scroll" }
  }
  return SLIDER_LOOK.includes(name)
    ? { target: SHELF_IDS.scroller(section.id, name), group: "controls" }
    : null
}
