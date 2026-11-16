import { z } from "@medusajs/framework/zod"
import { image, optional, recordId, shopText, title } from "../layout-fields"
import { bodyFields } from "./look"
import { storefrontLink } from "../menus"

/**
 * The strip gallery, `strip_gallery` (adr/0049 Ek 2026-11-16): two to
 * eight photographs as slanted strips, each one item with a source (a
 * record by its id, or none: `custom`) and the shop's own picture,
 * heading, line and link over it. A source's name, picture and price are
 * the storefront's to fetch; nothing of it is saved here.
 *
 * Mirrors `@qticaret/types`' `STRIP_GALLERY_LIMITS`, `STRIP_SOURCE_KINDS`,
 * `STRIP_GALLERY_SETTINGS` and `STRIP_GALLERY_DEFAULTS` (the backend reads
 * no runtime value from that package); a unit test keeps them equal.
 */
export const STRIP_GALLERY_LIMITS = {
  items: { min: 2, max: 8 },
  text: 160,
  title: 60,
  note: 80,
} as const

export const STRIP_SOURCE_KINDS = ["product", "category", "collection", "brand", "custom"] as const

export const STRIP_GALLERY_SETTINGS = {
  width: ["full", "boxed"],
  height: ["low", "medium", "high"],
  captions: ["on", "off"],
  strips_slant: ["soft", "medium", "steep"],
  strips_line: ["none", "thin", "medium", "thick"],
  strips_overlap: ["off", "on"],
  strips_dim: ["off", "on"],
} as const satisfies Record<string, readonly [string, ...string[]]>

type Setting = keyof typeof STRIP_GALLERY_SETTINGS
type Step<S extends Setting> = (typeof STRIP_GALLERY_SETTINGS)[S][number]

/** A new section's steps, and what one saved without a step reads as. */
export const STRIP_GALLERY_DEFAULTS: { readonly [S in Setting]: Step<S> } = {
  width: "full",
  height: "medium",
  captions: "on",
  strips_slant: "medium",
  strips_line: "thin",
  strips_overlap: "off",
  strips_dim: "on",
}

export const STRIP_GALLERY_SETTING_NAMES = Object.keys(STRIP_GALLERY_SETTINGS) as Setting[]

const SECTION_ERROR = { error: "storefront_layout.section_invalid" }

/** A step off the list is a stale or forged editor (a custom check: Medusa's answer drops an enum's key). */
const setting = <S extends Setting>(name: S) => {
  const steps: readonly unknown[] = STRIP_GALLERY_SETTINGS[name]
  return z
    .custom<Step<S>>((value) => steps.includes(value), SECTION_ERROR)
    .default(STRIP_GALLERY_DEFAULTS[name])
}

const record = <K extends string>(kind: K) =>
  z.object({ kind: z.literal(kind), target: recordId }).strict()

/** Where a strip takes what the shop left empty: a record by its id, or nothing. */
const source = z.discriminatedUnion(
  "kind",
  [
    record("product"),
    record("category"),
    record("collection"),
    record("brand"),
    z.object({ kind: z.literal("custom") }).strict(),
  ],
  SECTION_ERROR
)

const item = z
  .object({
    source,
    /** The shop's own picture; none: the source's. */
    image: optional(image),
    title: optional(shopText(STRIP_GALLERY_LIMITS.title)),
    note: optional(shopText(STRIP_GALLERY_LIMITS.note)),
    link: optional(storefrontLink),
  })
  .strict()
  // A `custom` strip has no source to take a picture from: the shop's is its only one
  .refine((each) => each.source.kind !== "custom" || each.image !== null, {
    message: "storefront_layout.image_invalid",
    path: ["image"],
  })

export const stripGallery = z
  .object({
    ...bodyFields,
    type: z.literal("strip_gallery"),
    title,
    text: optional(shopText(STRIP_GALLERY_LIMITS.text)),
    items: z.array(item).min(STRIP_GALLERY_LIMITS.items.min).max(STRIP_GALLERY_LIMITS.items.max),
    width: setting("width"),
    height: setting("height"),
    captions: setting("captions"),
    strips_slant: setting("strips_slant"),
    strips_line: setting("strips_line"),
    strips_overlap: setting("strips_overlap"),
    strips_dim: setting("strips_dim"),
  })
  .strict()

export type StripGallerySection = z.infer<typeof stripGallery>
export type StripGalleryItem = StripGallerySection["items"][number]
export type StripRecord = Exclude<StripGalleryItem["source"], { kind: "custom" }>
export type StripRecordKind = StripRecord["kind"]

/** The record an item names, if any. */
export const stripRecord = (each: StripGalleryItem): StripRecord | null =>
  each.source.kind === "custom" ? null : each.source

/** Every picture the shop chose for its strips (a source's own is the storefront's). */
export const stripGalleryImages = (section: StripGallerySection): string[] =>
  section.items.flatMap((each) => (each.image ? [each.image.url] : []))
