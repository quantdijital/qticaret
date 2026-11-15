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
  /** Past the last card is the first one again (the arrows never disable). */
  loop: ["off", "on"],
  /** A mouse may drag the row on a wide screen (touch always swipes). */
  drag: ["off", "on"],
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
  loop: "off",
  drag: "off",
}

/** The settings in the order the panel offers them. */
export const SCROLLER_SETTING_NAMES = Object.keys(SCROLLER_SETTINGS) as ScrollerSetting[]

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
