import { z } from "@medusajs/framework/zod"
import { optional, shopText, text, title } from "../layout-fields"
import { bodyFields } from "./look"

/**
 * The figures strip (`stats`, adr/0077 §10): an optional title over two to
 * six figures, each a short value, its label and an optional line. Its
 * ground and alignment are the look's. Mirrors `@qticaret/types`'
 * `STATS_LIMITS`, `STATS_SETTINGS` and `STATS_DEFAULTS` (the backend reads
 * no runtime value from that package); a unit test keeps them equal.
 */
export const STATS_LIMITS = {
  items: { min: 2, max: 6 },
  value: 16,
  label: 48,
  text: 120,
} as const

export const STATS_SETTINGS = {
  dividers: ["on", "off"],
} as const satisfies Record<string, readonly [string, ...string[]]>

type Setting = keyof typeof STATS_SETTINGS
type Step<S extends Setting> = (typeof STATS_SETTINGS)[S][number]

export const STATS_DEFAULTS: { readonly [S in Setting]: Step<S> } = {
  dividers: "on",
}

const SETTING_ERROR = { error: "storefront_layout.section_invalid" }

/** A step off the list is a stale or forged editor (a custom check: Medusa's answer drops an enum's key). */
const setting = <S extends Setting>(name: S) => {
  const steps: readonly unknown[] = STATS_SETTINGS[name]
  return z
    .custom<Step<S>>((value) => steps.includes(value), SETTING_ERROR)
    .default(STATS_DEFAULTS[name])
}

export const stats = z
  .object({
    ...bodyFields,
    type: z.literal("stats"),
    title,
    items: z
      .array(
        z
          .object({
            value: text(STATS_LIMITS.value),
            label: shopText(STATS_LIMITS.label),
            text: optional(shopText(STATS_LIMITS.text)),
          })
          .strict()
      )
      .min(STATS_LIMITS.items.min)
      .max(STATS_LIMITS.items.max),
    dividers: setting("dividers"),
  })
  .strict()

export type StatsSection = z.infer<typeof stats>
