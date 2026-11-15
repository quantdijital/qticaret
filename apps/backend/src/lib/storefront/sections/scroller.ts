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
  loop: ["off", "on"],
  drag: ["off", "on"],
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
  loop: "off",
  drag: "off",
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
