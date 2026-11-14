/**
 * The scrolling strip, `marquee` (adr/0049 Ek 2026-11-14 §4.1): one to
 * eight short items (an optional icon from the trust badges' list, a line,
 * an optional second line and link) that slide sideways, and how the strip
 * moves and looks. Every setting is a closed list of named steps, never a
 * number or a colour: the theme maps each onto its own scale. The
 * contract's list: a new step goes here first, then into the backend's
 * schema (`lib/storefront/sections/marquee.ts`, a mirror a test keeps
 * equal), then into the themes. The panel's Turkish names are
 * `storefront.editor.marquee.<setting>.<step>`.
 *
 * Imports nothing at run time (the storefront takes it from the
 * `@qticaret/types/section-marquee` subpath, which Turbopack resolves).
 */
export const MARQUEE_SETTINGS = {
  /** How fast it slides: the theme's slow, medium and fast loop. */
  speed: ["slow", "medium", "fast"],
  /** Which way the items travel. */
  direction: ["left", "right"],
  /** Its ground: the dark stage, the shop's own colour, a light tint; pairs the theme measured. */
  ground: ["stage", "primary", "light"],
  /** Small: a thin line of text; medium: items with an icon and a second line; large: a campaign set big. */
  size: ["small", "medium", "large"],
  /** What stands between two items. */
  separator: ["none", "dot", "star", "line"],
} as const satisfies Record<string, readonly [string, ...string[]]>

export type MarqueeSetting = keyof typeof MARQUEE_SETTINGS
export type MarqueeStep<S extends MarqueeSetting> = (typeof MARQUEE_SETTINGS)[S][number]

/** A new strip's settings, and what a reader takes for a step it does not know. */
export const MARQUEE_DEFAULTS: { readonly [S in MarqueeSetting]: MarqueeStep<S> } = {
  speed: "medium",
  direction: "left",
  ground: "stage",
  size: "medium",
  separator: "dot",
}

/** The settings in the order the panel offers them. */
export const MARQUEE_SETTING_NAMES = Object.keys(MARQUEE_SETTINGS) as MarqueeSetting[]

/** Items per strip, and each item's lines' lengths. */
export const MARQUEE_LIMITS = { items: { min: 1, max: 8 }, text: 60, subtext: 80 } as const

/**
 * Strips a page shows at most (§4.1): the header's one (on every page)
 * counts with the home, product or category page's own.
 */
export const MARQUEE_PER_PAGE = 2

/** A setting's step as a reader takes it: one this build does not know reads as the default. */
export function marqueeStepOf<S extends MarqueeSetting>(setting: S, step: unknown): MarqueeStep<S> {
  const steps: readonly unknown[] = MARQUEE_SETTINGS[setting]
  return steps.includes(step) ? (step as MarqueeStep<S>) : MARQUEE_DEFAULTS[setting]
}

/** The strip's settings as the design keeps them. */
export type MarqueeSettings = { [S in MarqueeSetting]: MarqueeStep<S> }
