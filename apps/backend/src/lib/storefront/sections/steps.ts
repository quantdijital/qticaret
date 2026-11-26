import { z } from "@medusajs/framework/zod"
import { optional, shopText, title } from "../layout-fields"
import { storefrontLink } from "../menus"
import { bodyFields } from "./look"

/**
 * Numbered steps (`steps`, adr/0077 §10): a title, a short intro and three
 * to six steps, each a title and an optional line, numbered by the theme,
 * and one optional link under them. Its ground and alignment are the
 * look's. Mirrors `@qticaret/types`' `STEPS_LIMITS`, `STEPS_SETTINGS` and
 * `STEPS_DEFAULTS` (the backend reads no runtime value from that package);
 * a unit test keeps them equal.
 */
export const STEPS_LIMITS = {
  items: { min: 3, max: 6 },
  intro: 240,
  title: 60,
  text: 240,
} as const

export const STEPS_SETTINGS = {
  layout: ["row", "column"],
  numbers: ["padded", "plain"],
  connector: ["off", "dotted"],
} as const satisfies Record<string, readonly [string, ...string[]]>

type Setting = keyof typeof STEPS_SETTINGS
type Step<S extends Setting> = (typeof STEPS_SETTINGS)[S][number]

export const STEPS_DEFAULTS: { readonly [S in Setting]: Step<S> } = {
  layout: "row",
  numbers: "padded",
  connector: "off",
}

const SETTING_ERROR = { error: "storefront_layout.section_invalid" }

/** A step off the list is a stale or forged editor (a custom check: Medusa's answer drops an enum's key). */
const setting = <S extends Setting>(name: S) => {
  const steps: readonly unknown[] = STEPS_SETTINGS[name]
  return z
    .custom<Step<S>>((value) => steps.includes(value), SETTING_ERROR)
    .default(STEPS_DEFAULTS[name])
}

export const steps = z
  .object({
    ...bodyFields,
    type: z.literal("steps"),
    /** None: the storefront's own words. */
    title,
    intro: optional(shopText(STEPS_LIMITS.intro)),
    items: z
      .array(
        z
          .object({
            title: shopText(STEPS_LIMITS.title),
            text: optional(shopText(STEPS_LIMITS.text)),
          })
          .strict()
      )
      .min(STEPS_LIMITS.items.min)
      .max(STEPS_LIMITS.items.max),
    link: optional(storefrontLink),
    layout: setting("layout"),
    numbers: setting("numbers"),
    // Kept only once chosen (a section saved before it reads as `off`, today's)
    connector: z
      .custom<Step<"connector">>(
        (value) => (STEPS_SETTINGS.connector as readonly unknown[]).includes(value),
        SETTING_ERROR
      )
      .optional(),
  })
  .strict()

export type StepsSection = z.infer<typeof steps>
