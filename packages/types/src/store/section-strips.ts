/**
 * The strip gallery (`strip_gallery`, adr/0049 Ek 2026-11-16): two to
 * eight photographs as upright strips with slanted seams across the
 * section, the one under the pointer widening (the featured product's
 * "Çapraz şeritler" drawing, on its own). Each strip is one item in one
 * global shape: a source (a product, a category, a collection, a brand,
 * or the shop's own picture, `custom`), and beside it, whatever the
 * source, the shop's own picture, heading, line under it and link. Each
 * left empty takes the source's: its picture, its name, a line of its own
 * (a product's price, a category's product count) and its page. A
 * `custom` strip has no source: its picture is the shop's, its link
 * optional. An item whose source is no longer live is left out; a section
 * left with none is not drawn.
 *
 * The settings are closed lists of named steps. The strips' look
 * (`strips_*`) has the featured product's names, steps and defaults
 * (`FEATURED_PRODUCT_SETTINGS`), so the two draw alike; a test keeps them
 * equal. The contract's list: a new step goes here first, then into the
 * backend's mirror (`lib/storefront/sections/strip-gallery.ts`, a test
 * keeps them equal), then into the themes. The panel's Turkish names are
 * `storefront.editor.stripGallery.<setting>.<step>`.
 *
 * Imports nothing at run time (the storefront takes it from the
 * `@qticaret/types/section-strips` subpath).
 */
import type { StoreLayoutImage, StoreLayoutLink } from "./layout.js"

/** Strips a section holds (the theme's `STRIPS_MOST` the upper bound), and its words' lengths. */
export const STRIP_GALLERY_LIMITS = {
  items: { min: 2, max: 8 },
  /** The section's line under its heading. */
  text: 160,
  /** A strip's own heading and the line under it. */
  title: 60,
  note: 80,
} as const

/** Where a strip takes what the shop left empty: a record, or nothing (`custom`). */
export const STRIP_SOURCE_KINDS = ["product", "category", "collection", "brand", "custom"] as const
export type StripSourceKind = (typeof STRIP_SOURCE_KINDS)[number]
export type StripRecordKind = Exclude<StripSourceKind, "custom">

/** A strip's source: a record by its id, or the shop's own picture alone. */
export type StripSource = { kind: "custom" } | { kind: StripRecordKind; target: string }

/**
 * The strips' look every strips drawing shares (the strip gallery, a
 * product rail's `strips` variant; the featured product keeps a copy a
 * test holds equal, its subpath may import nothing): the same names, steps
 * and defaults wherever the shop meets them.
 */
export const STRIPS_LOOK_SETTINGS = {
  /** The seams' slant: `soft` a fixed small run, `medium` about 7°, `steep` about 12°. */
  strips_slant: ["soft", "medium", "steep"],
  /** The line between two strips: none, 4, 12 or 16–24 px. */
  strips_line: ["none", "thin", "medium", "thick"],
  /** Each strip lies over the one before it, a line of the ground and a shadow on its seam. */
  strips_overlap: ["off", "on"],
  /** The other strips darken while one is under the pointer or holds the focus (from 1024 px). */
  strips_dim: ["off", "on"],
} as const satisfies Record<string, readonly [string, ...string[]]>

export type StripsLookSetting = keyof typeof STRIPS_LOOK_SETTINGS

/** A new strips drawing's look: medium seams, a thin line, apart, the others darkening. */
export const STRIPS_LOOK_DEFAULTS: {
  readonly [S in StripsLookSetting]: (typeof STRIPS_LOOK_SETTINGS)[S][number]
} = {
  strips_slant: "medium",
  strips_line: "thin",
  strips_overlap: "off",
  strips_dim: "on",
}

/** The strips' height: the theme's low, medium and high proportions (bilesen-standardi §3). */
export const STRIPS_HEIGHTS = ["low", "medium", "high"] as const

export const STRIP_GALLERY_SETTINGS = {
  /** `full`: edge to edge, square corners (the owner's "tüm yeri kaplar"); `boxed`: the container, rounded. */
  width: ["full", "boxed"],
  height: STRIPS_HEIGHTS,
  /** Each strip's heading and line over its foot, or the photographs alone. */
  captions: ["on", "off"],
  ...STRIPS_LOOK_SETTINGS,
} as const satisfies Record<string, readonly [string, ...string[]]>

export type StripGallerySetting = keyof typeof STRIP_GALLERY_SETTINGS
export type StripGalleryStep<S extends StripGallerySetting> =
  (typeof STRIP_GALLERY_SETTINGS)[S][number]

/** A new section's settings, and what a reader takes for one it lacks or does not know. */
export const STRIP_GALLERY_DEFAULTS: {
  readonly [S in StripGallerySetting]: StripGalleryStep<S>
} = {
  width: "full",
  height: "medium",
  captions: "on",
  ...STRIPS_LOOK_DEFAULTS,
}

/** The settings in the order the panel offers them. */
export const STRIP_GALLERY_SETTING_NAMES = Object.keys(
  STRIP_GALLERY_SETTINGS
) as StripGallerySetting[]

/** The section's settings as the design keeps them. */
export type StripGallerySettings = { [S in StripGallerySetting]: StripGalleryStep<S> }

/** Every setting as a reader takes it: one missing or not on this build's list reads as its default. */
export function stripGallerySettingsOf(
  section: Partial<Record<StripGallerySetting, unknown>>
): StripGallerySettings {
  const settings: Partial<Record<StripGallerySetting, string>> = {}
  for (const name of STRIP_GALLERY_SETTING_NAMES) {
    const steps: readonly unknown[] = STRIP_GALLERY_SETTINGS[name]
    settings[name] = steps.includes(section[name])
      ? (section[name] as string)
      : STRIP_GALLERY_DEFAULTS[name]
  }
  return settings as StripGallerySettings
}

/**
 * A product rail's `strips` variant (adr/0049 Ek 2026-11-16): each of its
 * products one strip, its name and price over the foot. Its own settings,
 * read only while the rail is `strips`: the strips' height and the shared
 * look. Here rather than in `section-shelf`, so they take the look's lists
 * themselves (a subpath imports nothing relative); how many strips is the
 * rail's `strips_count` (`SHELF_LIMITS.strips`). Mirrored by the backend's
 * `products.ts`; a test keeps them equal.
 */
export const SHELF_STRIPS_SETTINGS = {
  strips_height: STRIPS_HEIGHTS,
  ...STRIPS_LOOK_SETTINGS,
} as const satisfies Record<string, readonly [string, ...string[]]>

export type ShelfStripsSetting = keyof typeof SHELF_STRIPS_SETTINGS
export type ShelfStripsSettings = {
  [S in ShelfStripsSetting]: (typeof SHELF_STRIPS_SETTINGS)[S][number]
}

/**
 * A rail switched to strips, and what a reader takes for a step it lacks
 * or does not know: low strips (a rail sits among other sections; the
 * gallery's medium is a whole screen at 1440 px), the shared look.
 */
export const SHELF_STRIPS_DEFAULTS: Readonly<ShelfStripsSettings> = {
  strips_height: "low",
  ...STRIPS_LOOK_DEFAULTS,
}

/** The strips' settings in the order the panel offers them. */
export const SHELF_STRIPS_SETTING_NAMES = Object.keys(SHELF_STRIPS_SETTINGS) as ShelfStripsSetting[]

/** Every strips setting as a reader takes it: one missing or off its list reads as its default. */
export function shelfStripsOf(
  section: Partial<Record<ShelfStripsSetting, unknown>>
): ShelfStripsSettings {
  const settings: Partial<Record<ShelfStripsSetting, string>> = {}
  for (const name of SHELF_STRIPS_SETTING_NAMES) {
    const steps: readonly unknown[] = SHELF_STRIPS_SETTINGS[name]
    settings[name] = steps.includes(section[name])
      ? (section[name] as string)
      : SHELF_STRIPS_DEFAULTS[name]
  }
  return settings as ShelfStripsSettings
}

/**
 * One strip as `GET /store/storefront-layout` prints it: only an item
 * whose source is live (a gone one is left out, its id never printed).
 * The source's picture, name, line and page are the storefront's to
 * fetch, prices live; the shop's own words and link stand over them.
 */
export interface StoreStripGalleryItem {
  /** Its place among the design's items (the editor's field marks), counting a gone one. */
  at: number
  source: StripSource
  /** The shop's own picture; null: the source's (a `custom` strip always has one). */
  image: StoreLayoutImage | null
  /** The shop's heading, its `{tokens}` filled; null: the source's name. */
  title: string | null
  /** The shop's line under it; null: the source's own (a price, a count) or none. */
  note: string | null
  /** The shop's link; null (or a broken one): the source's page, none for `custom`. */
  link: StoreLayoutLink | null
}

/** The strip gallery as `GET /store/storefront-layout` prints it; settings read with `stripGallerySettingsOf`. */
export type StoreStripGallerySection = {
  id: string
  type: "strip_gallery"
  /** The section's heading (an h2); null: none, the strips named for a screen reader only. */
  title: string | null
  /** A line under the heading; null: none. */
  text: string | null
  items: StoreStripGalleryItem[]
} & Partial<StripGallerySettings>
