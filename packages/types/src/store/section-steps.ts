/**
 * Numbered steps (`steps`, adr/0077 §10): a title, a short intro and three
 * to six steps, each a title and an optional line, numbered by the theme
 * (no icon, no picture), with one optional link under them. Sector-free
 * ("Nasıl sipariş verilir", "Rezervasyon nasıl yapılır"). Its ground and
 * alignment are the section look's (`look.ground`, `look.align`). The
 * contract's list: a new step goes here first, then into the backend's
 * mirror (`lib/storefront/sections/steps.ts`, a test keeps them equal),
 * then into the themes. The panel's Turkish names are
 * `storefront.editor.steps.<setting>.*`.
 *
 * Imports nothing at run time (the storefront takes it from the
 * `@qticaret/types/section-steps` subpath).
 */
import type { StoreLayoutLink } from "./layout.js"

/** How many steps, and each part's longest text. */
export const STEPS_LIMITS = {
  items: { min: 3, max: 6 },
  intro: 240,
  title: 60,
  text: 240,
} as const

export const STEPS_SETTINGS = {
  /** `row`: the steps side by side from a wide screen; `column`: one under another. */
  layout: ["row", "column"],
  /** `padded`: "01", "02"; `plain`: "1", "2". */
  numbers: ["padded", "plain"],
} as const satisfies Record<string, readonly [string, ...string[]]>

export type StepsSetting = keyof typeof STEPS_SETTINGS
export type StepsStep<S extends StepsSetting> = (typeof STEPS_SETTINGS)[S][number]

/** A new section's settings, and what one without them reads as. */
export const STEPS_DEFAULTS: { readonly [S in StepsSetting]: StepsStep<S> } = {
  layout: "row",
  numbers: "padded",
}

export const STEPS_SETTING_NAMES = Object.keys(STEPS_SETTINGS) as StepsSetting[]

export type StepsSettings = { [S in StepsSetting]: StepsStep<S> }

/** Every setting as a reader takes it: one missing or off this build's list reads as its default. */
export function stepsSettingsOf(section: Partial<Record<StepsSetting, unknown>>): StepsSettings {
  const settings: Partial<Record<StepsSetting, string>> = {}
  for (const name of STEPS_SETTING_NAMES) {
    const steps: readonly unknown[] = STEPS_SETTINGS[name]
    settings[name] = steps.includes(section[name])
      ? (section[name] as string)
      : STEPS_DEFAULTS[name]
  }
  return settings as StepsSettings
}

/** A step's number as the theme prints it: "01" or "1". */
export const stepNumber = (index: number, numbers: StepsStep<"numbers">): string =>
  numbers === "padded" ? String(index + 1).padStart(2, "0") : String(index + 1)

/** One step: its title and an optional line (the shop's details filled). */
export interface StoreStepsItem {
  title: string
  text: string | null
}

/** Numbered steps in `GET /store/storefront-layout`. */
export type StoreStepsSection = {
  id: string
  type: "steps"
  /** None: the storefront's own words. */
  title: string | null
  intro: string | null
  items: StoreStepsItem[]
  /** The one link under the steps; none, or a broken one: null. */
  link: StoreLayoutLink | null
} & Partial<StepsSettings>
