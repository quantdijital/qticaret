import { z } from "@medusajs/framework/zod"

/**
 * The scroller kit (adr/0049 Ek 2026-11-15): one row of cards that slides
 * sideways, and how it is driven, shared by every section that scrolls
 * (the product rail's `carousel` first). Each setting is a closed list of
 * named steps the theme maps onto its own scale.
 *
 * Mirrors `@qticaret/types`' `SCROLLER_SETTINGS` and `SCROLLER_DEFAULTS`
 * (the backend reads no runtime value from that package); a unit test
 * keeps them equal.
 */
export const SCROLLER_SETTINGS = {
  desktop: ["three", "four", "five", "six"],
  mobile: ["one", "peek", "two"],
  arrows: ["always", "hover", "hidden"],
  arrow_style: ["round", "square", "plain"],
  arrow_position: ["head", "sides"],
  dots: ["off", "on"],
  autoplay: ["off", "on"],
  speed: ["slow", "medium", "fast"],
  autoplay_step: ["page", "card"],
  loop: ["off", "on"],
  drag: ["off", "on"],
  focus: ["off", "on"],
  // The slider's own controls (the openings' sliders); a row does not draw them yet
  play_button: ["on", "off"],
  dot_style: ["dots", "lines", "count", "progress"],
  controls_place: ["center", "start", "end"],
  arrow_size: ["small", "medium", "large"],
  controls_tone: ["dark", "light", "brand"],
} as const satisfies Record<string, readonly [string, ...string[]]>

type Setting = keyof typeof SCROLLER_SETTINGS
type Step<S extends Setting> = (typeof SCROLLER_SETTINGS)[S][number]

/** A new row's steps, filled where a section has none (no migration). */
export const SCROLLER_DEFAULTS: { readonly [S in Setting]: Step<S> } = {
  desktop: "four",
  mobile: "peek",
  arrows: "always",
  arrow_style: "round",
  arrow_position: "head",
  dots: "off",
  autoplay: "off",
  speed: "medium",
  autoplay_step: "page",
  loop: "off",
  drag: "off",
  focus: "off",
  play_button: "on",
  dot_style: "dots",
  controls_place: "center",
  arrow_size: "medium",
  controls_tone: "dark",
}

const SETTING_NAMES = Object.keys(SCROLLER_SETTINGS) as Setting[]

const SETTING_ERROR = { error: "storefront_layout.section_invalid" }

/**
 * A setting's steps: one off the list is a stale or forged editor, refused
 * with the error key (a custom check, as Medusa's answer drops an enum's
 * key, `look.ts`); none is the default.
 */
const setting = <S extends Setting>(name: S) => {
  const steps: readonly unknown[] = SCROLLER_SETTINGS[name]
  return z
    .custom<Step<S>>((value) => steps.includes(value), SETTING_ERROR)
    .default(SCROLLER_DEFAULTS[name])
}

function settingFields() {
  return Object.fromEntries(SETTING_NAMES.map((name) => [name, setting(name)])) as {
    [S in Setting]: ReturnType<typeof setting<S>>
  }
}

/**
 * The kit's settings as one field: a section saved without it, or without
 * a setting added since, reads each missing step as its default (the
 * object's own `prefault` runs the steps' defaults; a saved step stays).
 */
export const scroller = z.object(settingFields()).strict().prefault({})

export type ScrollerFields = z.infer<typeof scroller>
/**
 * The sliding opening's settings from the kit (bilesen-denetimi (b) 4):
 * the ones a slider of one slide in view has use for, with its own
 * defaults (its look before the kit: still, looping, dots and round
 * arrows showing). Mirrors `@qticaret/types`' `SLIDER_SCROLLER`,
 * `SLIDER_DEFAULTS` and `SLIDER_SECONDS`; a unit test keeps them equal.
 */
export const SLIDER_SCROLLER = [
  "autoplay",
  "speed",
  "loop",
  "arrows",
  "arrow_style",
  "dots",
  "play_button",
  "dot_style",
  "controls_place",
  "arrow_size",
  "controls_tone",
] as const satisfies readonly Setting[]

type SliderSetting = (typeof SLIDER_SCROLLER)[number]

export const SLIDER_DEFAULTS: { readonly [S in SliderSetting]: Step<S> } = {
  autoplay: "off",
  speed: "medium",
  loop: "on",
  arrows: "always",
  arrow_style: "round",
  dots: "on",
  play_button: "on",
  dot_style: "dots",
  controls_place: "center",
  arrow_size: "medium",
  controls_tone: "dark",
}

/**
 * The catalogue opening's slides (adr/0049 Ek 2026-11-15): the slider's
 * settings and defaults, still until the shop turns it on
 * (docs/tema/bilesen-standardi.md §4.5). Mirrors `@qticaret/types`'
 * `HERO_CATALOG_SLIDER_DEFAULTS`.
 */
export const HERO_CATALOG_SLIDER_DEFAULTS: { readonly [S in SliderSetting]: Step<S> } = {
  ...SLIDER_DEFAULTS,
  autoplay: "off",
}

/** Seconds a slide stays by speed step; saved seconds read as the nearest step. */
export const SLIDER_SECONDS: Readonly<Record<Step<"speed">, number>> = {
  fast: 5,
  medium: 6,
  slow: 8,
}

/** Saved seconds (5–10) as the nearest speed step: 5 fast, 6–7 medium, 8–10 slow. */
export const sliderSpeedOf = (seconds: number): Step<"speed"> =>
  seconds <= 5 ? "fast" : seconds <= 7 ? "medium" : "slow"

type SliderDefaults = { readonly [S in SliderSetting]: Step<S> }

const sliderSetting = <S extends SliderSetting>(name: S, defaults: SliderDefaults) => {
  const steps: readonly unknown[] = SCROLLER_SETTINGS[name]
  return z.custom<Step<S>>((value) => steps.includes(value), SETTING_ERROR).default(defaults[name])
}

function sliderFields(defaults: SliderDefaults) {
  return Object.fromEntries(
    SLIDER_SCROLLER.map((name) => [name, sliderSetting(name, defaults)])
  ) as {
    [S in SliderSetting]: ReturnType<typeof sliderSetting<S>>
  }
}

/** The slider's kit settings as one field; a step missing reads as the slider's default. */
export const sliderScroller = z.object(sliderFields(SLIDER_DEFAULTS)).strict()

/** The catalogue opening's slides' settings: the slider's, a step missing read as its own default. */
export const heroCatalogScroller = z.object(sliderFields(HERO_CATALOG_SLIDER_DEFAULTS)).strict()

export type SliderFields = z.infer<typeof sliderScroller>
