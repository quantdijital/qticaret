import type { StoreLayoutImage, StoreLayoutLink } from "./layout.js"

/**
 * The picture band's settings, `banner` (adr/0049 Ek 2026-11-14 §3.3 E2):
 * how the whole band stands (its width, height, where its words sit, how
 * strong the veil under them is, how its buttons look), each a closed list
 * of named steps the theme maps onto its own scale, never a number or a
 * colour. A slide's own tone (light words or dark) and its phone picture
 * follow the sliding opening's pattern (`hero_slider`). The contract's
 * list: a new step goes here first, then into the backend's schema
 * (`lib/storefront/sections/banner.ts`, a mirror a test keeps equal), then
 * into the themes. The panel's Turkish names are
 * `storefront.editor.banner.<setting>.<step>`.
 *
 * Every default is the band as it was drawn before these settings: the
 * container's width, its height, the words at the foot on the left over a
 * dark veil, a filled button. A theme keeps the words readable (4.5:1) at
 * every step: with no veil it sets them on a plate of their own.
 *
 * Imports nothing at run time (the storefront takes it from the
 * `@qticaret/types/section-banner` subpath, which Turbopack resolves).
 */
export const BANNER_SETTINGS = {
  /** `boxed`: the page's container, rounded; `full`: edge to edge. */
  width: ["boxed", "full"],
  /** The band's height: the theme's low, medium and high proportions. */
  height: ["low", "medium", "high"],
  /** Where the words stand on the picture: row (top, middle, bottom) by column. */
  text_position: [
    "top_left",
    "top_center",
    "top_right",
    "middle_left",
    "middle_center",
    "middle_right",
    "bottom_left",
    "bottom_center",
    "bottom_right",
  ],
  /** How much of the picture the veil under the words covers; `none`: the words on a plate. */
  overlay: ["none", "light", "medium", "strong"],
  /** The slides' buttons: filled, outlined or a plain link; a second button one step quieter. */
  button_style: ["solid", "outline", "text"],
} as const satisfies Record<string, readonly [string, ...string[]]>

export type BannerSetting = keyof typeof BANNER_SETTINGS
export type BannerStep<S extends BannerSetting> = (typeof BANNER_SETTINGS)[S][number]

/** A new band's settings, and what a reader takes for a step it does not know. */
export const BANNER_DEFAULTS: { readonly [S in BannerSetting]: BannerStep<S> } = {
  width: "boxed",
  height: "medium",
  text_position: "bottom_left",
  overlay: "medium",
  button_style: "solid",
}

/** The settings in the order the panel offers them. */
export const BANNER_SETTING_NAMES = Object.keys(BANNER_SETTINGS) as BannerSetting[]

/** A slide's words: `light` on a dark veil (the default), `dark` on a light one. */
export const BANNER_TONES = ["light", "dark"] as const
export type BannerTone = (typeof BANNER_TONES)[number]

/** A setting's step as a reader takes it: one this build does not know reads as the default. */
export function bannerStepOf<S extends BannerSetting>(setting: S, step: unknown): BannerStep<S> {
  const steps: readonly unknown[] = BANNER_SETTINGS[setting]
  return steps.includes(step) ? (step as BannerStep<S>) : BANNER_DEFAULTS[setting]
}

/** A slide's tone as a reader takes it: an unknown one (or none) reads as `light`. */
export const bannerToneOf = (tone: unknown): BannerTone => (tone === "dark" ? "dark" : "light")

/** The band's settings as the design keeps them. */
export type BannerSettings = { [S in BannerSetting]: BannerStep<S> }

/**
 * The band as the storefront reads it. The settings may be absent (a
 * backend from before them): read with `bannerStepOf` and `bannerToneOf`.
 */
export interface StoreBannerSection extends Partial<BannerSettings> {
  id: string
  type: "banner"
  slides: StoreBannerSlide[]
}

export interface StoreBannerSlide {
  image: StoreLayoutImage
  /** A phone's own picture; null or absent: the wide one. */
  mobile_image?: StoreLayoutImage | null
  heading: string | null
  text: string | null
  link: StoreLayoutLink | null
  /** A second, quieter button; a broken one is null. */
  second_link?: StoreLayoutLink | null
  tone?: BannerTone
}
