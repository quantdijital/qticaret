import {
  SCROLLER_DEFAULTS,
  SLIDER_DEFAULTS,
  SLIDER_SCROLLER,
  sliderSettingsOf,
} from "@qticaret/types"
import type { ScrollerSettings, SliderSettings } from "@qticaret/types"
import type { HeroSliderSection } from "@/features/storefront/api/layout"
import { SLIDER_OTHER } from "./scroller-groups"

/** The slider's kit settings as the kit's fields take them (the ones it has no use for at their defaults). */
export const asKit = (section: HeroSliderSection): ScrollerSettings => ({
  ...SCROLLER_DEFAULTS,
  ...sliderSettingsOf(section),
})

/**
 * The slider with the kit's fields' answer (bilesen-denetimi (b) 4): only
 * the settings it has use for kept, the switches from before the kit
 * dropped, and seconds saved before the kit dropped once the shop picks
 * another speed.
 */
export function withSliderKit(
  section: HeroSliderSection,
  next: ScrollerSettings
): HeroSliderSection {
  const scroller = Object.fromEntries(
    SLIDER_SCROLLER.map((name) => [name, next[name]])
  ) as SliderSettings
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

/** How many of the slider's closed kit settings are off the slider's default. */
export const sliderOtherCount = (section: HeroSliderSection): number => {
  const settings = sliderSettingsOf(section)
  return SLIDER_OTHER.filter((name) => settings[name] !== SLIDER_DEFAULTS[name]).length
}
