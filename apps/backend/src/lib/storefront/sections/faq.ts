import { z } from "@medusajs/framework/zod"
import { LAYOUT_LIMITS, shopText, text, title } from "../layout-fields"
import { bodyFields } from "./look"

/**
 * The FAQ section's settings (docs/tema/bilesen-denetimi (b) 8): the first
 * question open, and one open at a time; both off, as before. Mirrors
 * `@qticaret/types`' `FAQ_SETTINGS` and `FAQ_DEFAULTS` (the backend reads
 * no runtime value from that package); a unit test keeps them equal.
 */
export const FAQ_SETTINGS = {
  open_first: ["off", "on"],
  single_open: ["off", "on"],
} as const satisfies Record<string, readonly [string, ...string[]]>

type Setting = keyof typeof FAQ_SETTINGS
type Step<S extends Setting> = (typeof FAQ_SETTINGS)[S][number]

/** A new section's steps, filled where one saved before them has none (no migration). */
export const FAQ_DEFAULTS: { readonly [S in Setting]: Step<S> } = {
  open_first: "off",
  single_open: "off",
}

const SETTING_ERROR = { error: "storefront_layout.section_invalid" }

/** A step off the list is a stale or forged editor (a custom check: Medusa's answer drops an enum's key). */
const setting = <S extends Setting>(name: S) => {
  const steps: readonly unknown[] = FAQ_SETTINGS[name]
  return z
    .custom<Step<S>>((value) => steps.includes(value), SETTING_ERROR)
    .default(FAQ_DEFAULTS[name])
}

/** Questions and answers, shown on the page; never `FAQPage` structured data (docs/13 §5). */
export const faq = z
  .object({
    ...bodyFields,
    type: z.literal("faq"),
    title,
    items: z
      .array(z.object({ question: text(160), answer: shopText(600) }).strict())
      .min(1)
      .max(LAYOUT_LIMITS.faq),
    open_first: setting("open_first"),
    single_open: setting("single_open"),
  })
  .strict()
