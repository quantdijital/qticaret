/**
 * The featured product's settings (`featured_product`, adr/0049 Ek
 * 2026-11-15): how its photographs stand beside its words. `gallery`
 * `collage` "Kolaj" is the drawing from before the setting (the first
 * large, two more beside it) and so the default; `strips` "Çapraz
 * şeritler" sets them side by side as equal upright strips with slanted
 * seams, the one under the pointer widening. The contract's list: a new
 * step goes here first, then into the backend's mirror
 * (`lib/storefront/sections/featured-product.ts`, a test keeps them equal),
 * then into the themes. The panel's Turkish names are
 * `storefront.editor.featured.galleries.<step>`.
 *
 * Imports nothing at run time (the storefront takes it from the
 * `@qticaret/types/section-featured` subpath).
 */
export const FEATURED_PRODUCT_SETTINGS = {
  /** `collage`: one large, two small beside it; `strips`: equal slanted strips side by side. */
  gallery: ["collage", "strips"],
} as const satisfies Record<string, readonly [string, ...string[]]>

export type FeaturedProductSetting = keyof typeof FEATURED_PRODUCT_SETTINGS
export type FeaturedProductStep<S extends FeaturedProductSetting> =
  (typeof FEATURED_PRODUCT_SETTINGS)[S][number]

/** A new section's settings, and what one saved before them reads as: the collage. */
export const FEATURED_PRODUCT_DEFAULTS: {
  readonly [S in FeaturedProductSetting]: FeaturedProductStep<S>
} = {
  gallery: "collage",
}

/** The settings in the order the panel offers them. */
export const FEATURED_PRODUCT_SETTING_NAMES = Object.keys(
  FEATURED_PRODUCT_SETTINGS
) as FeaturedProductSetting[]

/** The section's settings as the design keeps them. */
export type FeaturedProductSettings = {
  [S in FeaturedProductSetting]: FeaturedProductStep<S>
}

/** Every setting as a reader takes it: one missing or not on this build's list reads as its default. */
export function featuredProductSettingsOf(
  section: Partial<Record<FeaturedProductSetting, unknown>>
): FeaturedProductSettings {
  const settings: Partial<Record<FeaturedProductSetting, string>> = {}
  for (const name of FEATURED_PRODUCT_SETTING_NAMES) {
    const steps: readonly unknown[] = FEATURED_PRODUCT_SETTINGS[name]
    settings[name] = steps.includes(section[name])
      ? (section[name] as string)
      : FEATURED_PRODUCT_DEFAULTS[name]
  }
  return settings as FeaturedProductSettings
}
