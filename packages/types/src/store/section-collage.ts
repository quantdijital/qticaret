/**
 * The photo collage (`photo_collage`, adr/0077 §10): an optional title and
 * intro over three to seven of the shop's own photographs, each with the
 * words that describe it (required: a collage is pictures and nothing
 * else names them), an optional caption and an optional link. Sector-free:
 * a workshop, a tour, a shop floor. Its ground and alignment are the
 * section look's (`look.ground`, `look.align`); its corners and gaps the
 * theme's own (style kit), never the section's. The contract's list: a
 * new step goes here first, then into the backend's mirror
 * (`lib/storefront/sections/photo-collage.ts`, a test keeps them equal),
 * then into the themes. The panel's Turkish names are
 * `storefront.editor.photoCollage.<setting>.*`.
 *
 * Imports nothing at run time (the storefront takes it from the
 * `@qticaret/types/section-collage` subpath).
 */
import type { StoreLayoutImage, StoreLayoutLink } from "./layout.js"

/** How many photographs, and each text's longest. */
export const PHOTO_COLLAGE_LIMITS = {
  items: { min: 3, max: 7 },
  intro: 240,
  caption: 60,
  alt: 300,
} as const

export const PHOTO_COLLAGE_SETTINGS = {
  /**
   * `asymmetric` "Asimetrik": the first photograph large beside the others
   * in uneven tiles; `even` "Eşit ızgara": every photograph the same tile.
   */
  layout: ["asymmetric", "even"],
  /**
   * Below 1024 px: `scroll` "Yana kaydır", one row swiped sideways, the
   * next one peeking (the strip gallery's phone row); `stack` "Alt alta",
   * one column.
   */
  phone: ["scroll", "stack"],
} as const satisfies Record<string, readonly [string, ...string[]]>

export type PhotoCollageSetting = keyof typeof PHOTO_COLLAGE_SETTINGS
export type PhotoCollageStep<S extends PhotoCollageSetting> =
  (typeof PHOTO_COLLAGE_SETTINGS)[S][number]

/** A new collage's settings, and what one without them reads as. */
export const PHOTO_COLLAGE_DEFAULTS: {
  readonly [S in PhotoCollageSetting]: PhotoCollageStep<S>
} = {
  layout: "asymmetric",
  phone: "scroll",
}

export const PHOTO_COLLAGE_SETTING_NAMES = Object.keys(
  PHOTO_COLLAGE_SETTINGS
) as PhotoCollageSetting[]

export type PhotoCollageSettings = { [S in PhotoCollageSetting]: PhotoCollageStep<S> }

/** Every setting as a reader takes it: one missing or off this build's list reads as its default. */
export function photoCollageSettingsOf(
  section: Partial<Record<PhotoCollageSetting, unknown>>
): PhotoCollageSettings {
  const settings: Partial<Record<PhotoCollageSetting, string>> = {}
  for (const name of PHOTO_COLLAGE_SETTING_NAMES) {
    const steps: readonly unknown[] = PHOTO_COLLAGE_SETTINGS[name]
    settings[name] = steps.includes(section[name])
      ? (section[name] as string)
      : PHOTO_COLLAGE_DEFAULTS[name]
  }
  return settings as PhotoCollageSettings
}

/** One photograph: the shop's picture with its words, an optional caption and link. */
export interface StorePhotoCollageItem {
  image: StoreLayoutImage
  /** The shop's caption, its details filled; null: none. */
  caption: string | null
  /** The shop's link; null (or a broken one): the photograph links nowhere. */
  link: StoreLayoutLink | null
}

/** The photo collage in `GET /store/storefront-layout`. */
export type StorePhotoCollageSection = {
  id: string
  type: "photo_collage"
  /** None: no heading (the collage is named for screen readers by the storefront). */
  title: string | null
  intro: string | null
  items: StorePhotoCollageItem[]
} & Partial<PhotoCollageSettings>
