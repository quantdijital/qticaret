/**
 * The FAQ section's settings (`faq`, docs/tema/bilesen-denetimi (b) 8,
 * 1.14): whether the first question comes open, and whether opening one
 * closes the one open before it. Named `off`/`on` steps (bilesen-standardi
 * §3's rule for a switch that may take a third step), both off by default:
 * every question closed and each opened on its own, as before. The
 * contract's list: a new step goes here first, then into the backend's
 * mirror (`lib/storefront/sections/faq.ts`, a test keeps them equal), then
 * into the themes. The panel's Turkish names are
 * `storefront.editor.faq.<setting>.*`.
 *
 * Imports nothing at run time (the storefront takes it from the
 * `@qticaret/types/section-faq` subpath).
 */
export const FAQ_SETTINGS = {
  /** The first question open when the page comes (its answer is in the HTML either way). */
  open_first: ["off", "on"],
  /** Opening a question closes the one open before it (an accordion). */
  single_open: ["off", "on"],
} as const satisfies Record<string, readonly [string, ...string[]]>

export type FaqSetting = keyof typeof FAQ_SETTINGS
export type FaqStep<S extends FaqSetting> = (typeof FAQ_SETTINGS)[S][number]

/** A new section's settings, and what one saved before them reads as: all closed, each on its own. */
export const FAQ_DEFAULTS: { readonly [S in FaqSetting]: FaqStep<S> } = {
  open_first: "off",
  single_open: "off",
}

/** The settings in the order the panel offers them. */
export const FAQ_SETTING_NAMES = Object.keys(FAQ_SETTINGS) as FaqSetting[]

/** The section's settings as the design keeps them. */
export type FaqSettings = { [S in FaqSetting]: FaqStep<S> }

/** Every setting as a reader takes it: one missing or not on this build's list reads as its default. */
export function faqSettingsOf(section: Partial<Record<FaqSetting, unknown>>): FaqSettings {
  const settings: Partial<Record<FaqSetting, string>> = {}
  for (const name of FAQ_SETTING_NAMES) {
    const steps: readonly unknown[] = FAQ_SETTINGS[name]
    settings[name] = steps.includes(section[name]) ? (section[name] as string) : FAQ_DEFAULTS[name]
  }
  return settings as FaqSettings
}
