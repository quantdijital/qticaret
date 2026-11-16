/**
 * The featured product's settings (`featured_product`, adr/0049 Ek
 * 2026-11-15): how its photographs stand beside its words. `gallery`
 * `collage` "Kolaj" is the drawing from before the setting (the first
 * large, two more beside it) and so the default; `strips` "Çapraz
 * şeritler" sets them side by side as equal upright strips with slanted
 * seams, the one under the pointer widening.
 *
 * The strips' own look (adr/0049 Ek 2026-11-16), read only while
 * `gallery` is `strips`: where they stand (`strips_layout` `side` beside
 * the words, `wide` across the whole stage over them), how steep the
 * seams run, the line between two strips, whether each lies over the one
 * before it, and whether the others darken while one is looked at. The
 * strips came out a day before these and no preset uses them, so their
 * defaults are the bolder drawing the owner asked for (steeper seams, a
 * thin line, the others darkening); the drawing from before them is
 * `side`/`soft`/`medium`/`off`/`off`.
 *
 * The contract's list: a new step goes here first, then into the
 * backend's mirror (`lib/storefront/sections/featured-product.ts`, a test
 * keeps them equal), then into the themes. The panel's Turkish names are
 * `storefront.editor.featured.<setting's list>.<step>`.
 *
 * Imports nothing at run time (the storefront takes it from the
 * `@qticaret/types/section-featured` subpath).
 */
export const FEATURED_PRODUCT_SETTINGS = {
  /** `collage`: one large, two small beside it; `strips`: equal slanted strips side by side. */
  gallery: ["collage", "strips"],
  /** The strips beside the words, or across the whole stage with the words under them. */
  strips_layout: ["side", "wide"],
  /** The seams' slant: `soft` the fixed run from before, `medium` about 7°, `steep` about 12°. */
  strips_slant: ["soft", "medium", "steep"],
  /** The line between two strips: none, 4, 12 (the gap from before) or 16–24 px. */
  strips_line: ["none", "thin", "medium", "thick"],
  /** Each strip lies over the one before it, a line of the ground and a shadow on its seam. */
  strips_overlap: ["off", "on"],
  /** The other strips darken while one is under the pointer or holds the focus (from 1024 px). */
  strips_dim: ["off", "on"],
} as const satisfies Record<string, readonly [string, ...string[]]>

export type FeaturedProductSetting = keyof typeof FEATURED_PRODUCT_SETTINGS
export type FeaturedProductStep<S extends FeaturedProductSetting> =
  (typeof FEATURED_PRODUCT_SETTINGS)[S][number]

/** A new section's settings, and what one saved before them reads as: the collage. */
export const FEATURED_PRODUCT_DEFAULTS: {
  readonly [S in FeaturedProductSetting]: FeaturedProductStep<S>
} = {
  gallery: "collage",
  strips_layout: "side",
  strips_slant: "medium",
  strips_line: "thin",
  strips_overlap: "off",
  strips_dim: "on",
}

/** The strips' look, read and offered only while `gallery` is `strips`. */
export const FEATURED_STRIPS_SETTINGS = [
  "strips_layout",
  "strips_slant",
  "strips_line",
  "strips_overlap",
  "strips_dim",
] as const satisfies readonly FeaturedProductSetting[]

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
