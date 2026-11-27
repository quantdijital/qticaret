/**
 * The scroller kit (adr/0049 Ek 2026-11-15, owner's request): one row of
 * cards that slides sideways (CSS scroll-snap), and how it is driven. One
 * shared set of settings for every section that scrolls; the product rail's
 * `carousel` is the first to use it (image bands, posts and brands may take
 * it later). Every setting is a closed list of named steps, never a number
 * or a colour: the theme maps each onto its own scale. The contract's list:
 * a new step goes here first, then into the backend's schema
 * (`lib/storefront/sections/scroller.ts`, a mirror a test keeps equal),
 * then into the themes. The panel's Turkish names are
 * `storefront.editor.scroller.<setting>.<step>`.
 *
 * Imports nothing at run time (the storefront takes it from the
 * `@qticaret/types/section-scroller` subpath, which Turbopack resolves).
 */
export const SCROLLER_SETTINGS = {
  /** Cards in view on a wide screen; the theme steps down between a phone and a wide screen. */
  desktop: ["three", "four", "five", "six"],
  /** Cards in view on a phone: one, one with the next one's edge showing, or two. */
  mobile: ["one", "peek", "two"],
  /** When the arrows show: always, while the pointer is over the row (always on touch), never. */
  arrows: ["always", "hover", "hidden"],
  /** The arrows' shape: a round button, a square one, or a bare chevron. */
  arrow_style: ["round", "square", "plain"],
  /** Where the arrows stand: either side of the row, or beside the section's heading. */
  arrow_position: ["head", "sides"],
  /** A dot per page under the row. */
  dots: ["off", "on"],
  /**
   * Turning by itself: it stops under the pointer and while focus is in it,
   * shows a pause button (WCAG 2.2.2) and never runs for a visitor asking
   * for reduced motion.
   */
  autoplay: ["off", "on"],
  /** How long a page stays while it turns by itself. */
  speed: ["slow", "medium", "fast"],
  /**
   * How far it moves each time it turns by itself: a page (the width in
   * view), or one card. The arrows always step a page.
   */
  autoplay_step: ["page", "card"],
  /** Past the last card is the first one again (the arrows never disable). */
  loop: ["off", "on"],
  /** A mouse may drag the row on a wide screen (touch always swipes). */
  drag: ["off", "on"],
  /** From 1024 px the card in the middle of the row full size, the ones toward the edges smaller. */
  focus: ["off", "on"],
  // The slider's own controls (a slide stage: the openings' sliders); a row does not draw them yet
  /**
   * The pause button while it turns by itself: shown, or hidden until the
   * keyboard reaches it (the pointer and the focus still hold the slides).
   */
  play_button: ["on", "off"],
  /** How the dots tell the slides: a dot each, a line each, "2 / 4", or a bar filled to the slide. */
  dot_style: ["dots", "lines", "count", "progress"],
  /** Where the dots and the pause button stand under the slides. */
  controls_place: ["center", "start", "end"],
  /** The arrows' size (from 1024 px). */
  arrow_size: ["small", "medium", "large"],
  /** The arrows' and the dots' ground: the graphite, a light one, or the shop's colour. */
  controls_tone: ["dark", "light", "brand"],
} as const satisfies Record<string, readonly [string, ...string[]]>

export type ScrollerSetting = keyof typeof SCROLLER_SETTINGS
export type ScrollerStep<S extends ScrollerSetting> = (typeof SCROLLER_SETTINGS)[S][number]

/**
 * A new row's settings, and what a reader takes for a step it does not
 * know or a section saved before the setting existed: still, arrows beside
 * the heading, four cards across and the next one peeking on a phone.
 */
export const SCROLLER_DEFAULTS: { readonly [S in ScrollerSetting]: ScrollerStep<S> } = {
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

/** The settings in the order the panel offers them. */
export const SCROLLER_SETTING_NAMES = Object.keys(SCROLLER_SETTINGS) as ScrollerSetting[]

/** The settings a row of cards (a product rail's carousel) draws: not the slider's own controls. */
export const ROW_SCROLLER = [
  "desktop",
  "mobile",
  "arrows",
  "arrow_style",
  "arrow_position",
  "dots",
  "autoplay",
  "speed",
  "autoplay_step",
  "loop",
  "drag",
  "focus",
] as const satisfies readonly ScrollerSetting[]

/** A setting's step as a reader takes it: one this build does not know reads as the default. */
export function scrollerStepOf<S extends ScrollerSetting>(
  setting: S,
  step: unknown
): ScrollerStep<S> {
  const steps: readonly unknown[] = SCROLLER_SETTINGS[setting]
  return steps.includes(step) ? (step as ScrollerStep<S>) : SCROLLER_DEFAULTS[setting]
}

/** A row's settings as the design keeps them. */
export type ScrollerSettings = { [S in ScrollerSetting]: ScrollerStep<S> }

/** Every setting as a reader takes it (`scrollerStepOf`); none, or one missing, read as the default. */
export function scrollerSettingsOf(value: unknown): ScrollerSettings {
  const given: Partial<Record<ScrollerSetting, unknown>> =
    typeof value === "object" && value !== null ? value : {}
  const settings: Partial<Record<ScrollerSetting, string>> = {}
  for (const name of SCROLLER_SETTING_NAMES) {
    settings[name] = scrollerStepOf(name, given[name])
  }
  return settings as ScrollerSettings
}

/**
 * The sliding opening's (`hero_slider`) settings from the kit
 * (docs/tema/bilesen-denetimi (b) 4, 1.3): the ones a slider of one slide
 * in view has use for, under the kit's names and steps. Not offered: the
 * cards in view (always one), the arrows' place (always either side of the
 * slide) and dragging (a slide swipes on touch). Its defaults are the
 * slider's look before it took the kit: still, looping, its dots and
 * round arrows showing; the controls' own (the pause button, the dots'
 * style and place, the arrows' size, the ground) as they were drawn.
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
] as const satisfies readonly ScrollerSetting[]

export type SliderSetting = (typeof SLIDER_SCROLLER)[number]

/** A slider's kit settings as the design keeps them. */
export type SliderSettings = { [S in SliderSetting]: ScrollerStep<S> }

export const SLIDER_DEFAULTS: SliderSettings = {
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
 * The catalogue opening's slides (`hero` `category_list` with two or more,
 * adr/0049 Ek 2026-11-15): the slider's settings under the same names and
 * steps and the same defaults: still until the shop turns it on (an opening
 * slider never turns by itself unasked, docs/tema/bilesen-standardi.md
 * §4.5); one slide never moves whatever they say.
 */
export const HERO_CATALOG_SLIDER_DEFAULTS: SliderSettings = {
  ...SLIDER_DEFAULTS,
  autoplay: "off",
}

/**
 * Seconds a slide stays while it plays, by the kit's speed step: the
 * slider's own (a slide holds longer than a rail's page). A slider saved
 * with seconds (5–10) before the kit reads them as the nearest step
 * (`sliderSpeedOf`); seconds no step keeps (7, 9, 10) still play as saved
 * until the shop picks a step (`sliderSecondsOf`).
 */
export const SLIDER_SECONDS: Readonly<Record<ScrollerStep<"speed">, number>> = {
  fast: 5,
  medium: 6,
  slow: 8,
}

/** The seconds a slider saved before the kit could hold. */
export const SLIDER_LEGACY_SECONDS = { min: 5, max: 10 } as const

/** Saved seconds as the nearest speed step: 5 fast, 6–7 medium, 8–10 slow. */
export const sliderSpeedOf = (seconds: number): ScrollerStep<"speed"> =>
  seconds <= 5 ? "fast" : seconds <= 7 ? "medium" : "slow"

const isLegacySeconds = (value: unknown): value is number =>
  typeof value === "number" &&
  Number.isInteger(value) &&
  value >= SLIDER_LEGACY_SECONDS.min &&
  value <= SLIDER_LEGACY_SECONDS.max

/** A slider as a reader may find it: the kit's settings, or the switches and seconds from before it. */
export interface SliderSource {
  scroller?: unknown
  autoplay?: unknown
  interval?: unknown
  dots?: unknown
  arrows?: unknown
}

/**
 * A slider's kit settings as a reader takes them: its `scroller` when it
 * has one (a step off the list or missing reads as the slider's default);
 * else the switches and seconds saved before the kit (`autoplay`, `dots`,
 * `arrows` yes/no, `interval` the nearest step), so it draws as it did.
 * A section with its own defaults (the catalogue opening's) passes them.
 */
export function sliderSettingsOf(
  section: SliderSource,
  defaults: SliderSettings = SLIDER_DEFAULTS
): SliderSettings {
  const given: Partial<Record<SliderSetting, unknown>> =
    typeof section.scroller === "object" && section.scroller !== null
      ? section.scroller
      : {
          autoplay: section.autoplay === true ? "on" : undefined,
          dots: section.dots === false ? "off" : undefined,
          arrows: section.arrows === false ? "hidden" : undefined,
          speed: isLegacySeconds(section.interval) ? sliderSpeedOf(section.interval) : undefined,
        }
  const settings: Partial<Record<SliderSetting, string>> = {}
  for (const name of SLIDER_SCROLLER) {
    const steps: readonly unknown[] = SCROLLER_SETTINGS[name]
    settings[name] = steps.includes(given[name]) ? (given[name] as string) : defaults[name]
  }
  return settings as SliderSettings
}

/**
 * Seconds a slide stays while it plays: seconds saved before the kit when
 * they still stand for the speed in force (no step keeps them), else the
 * speed step's own (`SLIDER_SECONDS`).
 */
export function sliderSecondsOf(section: SliderSource, settings: SliderSettings): number {
  return isLegacySeconds(section.interval) && sliderSpeedOf(section.interval) === settings.speed
    ? section.interval
    : SLIDER_SECONDS[settings.speed]
}
