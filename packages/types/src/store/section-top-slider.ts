import type { StoreLayoutImage, StoreLayoutLink } from "./layout.js"

/**
 * The top image slider (`top_slider`, owner 2026-11-27): a full-width band
 * of the shop's pictures above the header, one at a time, a section of
 * its own in the header group (never the text strip's). Its settings are
 * closed lists of named steps the theme maps onto its own scale; the
 * backend mirrors them (`lib/storefront/sections/top-slider.ts`, a test
 * keeps them equal). The panel's Turkish names are
 * `storefront.editor.topSlider.<setting>.<step>`.
 *
 * Imports nothing at run time (the storefront takes it from the
 * `@qticaret/types/section-top-slider` subpath).
 */
export const TOP_SLIDER_SETTINGS = {
  /** The band's height: 48, 80 or 120 px on a wide screen, scaled on a phone. */
  height: ["thin", "medium", "tall"],
  /** How long a slide stays: 8, 6 or 4 s, as the text strip's. */
  interval: ["slow", "medium", "fast"],
  /** How a slide gives way: sliding across or fading in place. */
  transition: ["slide", "fade"],
  /** Small previous / next arrows on the band. */
  arrows: ["on", "off"],
  /** A dot for each slide under the pictures. */
  dots: ["off", "on"],
} as const satisfies Record<string, readonly [string, ...string[]]>

export type TopSliderSetting = keyof typeof TOP_SLIDER_SETTINGS
export type TopSliderStep<S extends TopSliderSetting> = (typeof TOP_SLIDER_SETTINGS)[S][number]
export type TopSliderSettings = { [S in TopSliderSetting]: TopSliderStep<S> }

/** A new slider's steps, and what one missing reads as. */
export const TOP_SLIDER_DEFAULTS: TopSliderSettings = {
  height: "thin",
  interval: "medium",
  transition: "slide",
  arrows: "on",
  dots: "off",
}

export const TOP_SLIDER_SETTING_NAMES = Object.keys(TOP_SLIDER_SETTINGS) as TopSliderSetting[]

/** Every setting as a reader takes it: one missing or not on this build's list reads as its default. */
export function topSliderSettingsOf(
  section: Partial<Record<TopSliderSetting, unknown>>
): TopSliderSettings {
  const settings: Partial<Record<TopSliderSetting, string>> = {}
  for (const name of TOP_SLIDER_SETTING_NAMES) {
    const steps: readonly unknown[] = TOP_SLIDER_SETTINGS[name]
    settings[name] = steps.includes(section[name])
      ? (section[name] as string)
      : TOP_SLIDER_DEFAULTS[name]
  }
  return settings as TopSliderSettings
}

/** One slide as the backend prints it: its picture's words always written. */
export interface StoreTopSlide {
  image: StoreLayoutImage
  /** A phone's own picture; null: the wide one. */
  mobile_image: StoreLayoutImage | null
  /** A broken one is null. */
  link: StoreLayoutLink | null
}

export type StoreTopSliderSection = {
  id: string
  type: "top_slider"
  slides: StoreTopSlide[]
} & Partial<TopSliderSettings>
