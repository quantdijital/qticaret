import { z } from "@medusajs/framework/zod"
import { optional, recordId, shopText, title } from "../layout-fields"
import { bodyFields } from "./look"

/**
 * The featured product's settings (adr/0049 Ek 2026-11-15): how its
 * photographs stand, today's collage by default. Mirrors `@qticaret/types`'
 * `FEATURED_PRODUCT_SETTINGS` and `FEATURED_PRODUCT_DEFAULTS` (the backend
 * reads no runtime value from that package); a unit test keeps them equal.
 */
export const FEATURED_PRODUCT_SETTINGS = {
  gallery: ["collage", "strips"],
} as const satisfies Record<string, readonly [string, ...string[]]>

type Setting = keyof typeof FEATURED_PRODUCT_SETTINGS
type Step<S extends Setting> = (typeof FEATURED_PRODUCT_SETTINGS)[S][number]

/** A new section's steps, filled where one saved before them has none (no migration). */
export const FEATURED_PRODUCT_DEFAULTS: { readonly [S in Setting]: Step<S> } = {
  gallery: "collage",
}

const SETTING_ERROR = { error: "storefront_layout.section_invalid" }

/** A step off the list is a stale or forged editor (a custom check: Medusa's answer drops an enum's key). */
const setting = <S extends Setting>(name: S) => {
  const steps: readonly unknown[] = FEATURED_PRODUCT_SETTINGS[name]
  return z
    .custom<Step<S>>((value) => steps.includes(value), SETTING_ERROR)
    .default(FEATURED_PRODUCT_DEFAULTS[name])
}

/** One product up close (adr/0046 Ek 2026-11-05): the storefront adds its facts and spec table. */
export const featuredProduct = z
  .object({
    ...bodyFields,
    type: z.literal("featured_product"),
    title,
    text: optional(shopText(240)),
    product_id: recordId,
    gallery: setting("gallery"),
  })
  .strict()
