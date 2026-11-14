import { z } from "zod"

/**
 * A storefront preset's files as this package reads them (adr/0063 §2):
 * `packs/<pack>/presets/<code>/`. A preset is data: theme settings, the
 * page design, menus, optional demo records and images, for a theme that
 * already draws them. The package owns the frame (the manifest, which
 * files there are, how a reference is written, paths that stay in the
 * folder, image count and size); what a theme setting, section, menu or
 * demo record holds is the backend's to judge with its own schemas, as a
 * whole, before anything is applied.
 */

export const PRESET_FORMAT = "quant-storefront-preset"

/** A preset's code: its folder's name. */
export const PRESET_CODE = /^[a-z][a-z0-9-]{1,39}$/

/** A theme's code (`atolye`); the backend lists only presets of an installed theme. */
const THEME_CODE = /^[a-z][a-z0-9-]{1,39}$/

/** What a `$handle` may point at: records a shop has by a URL handle. */
export const HANDLE_KINDS = ["category", "product", "collection", "brand", "page"] as const
export type HandleKind = (typeof HANDLE_KINDS)[number]

/** `category:cakilar`: a record's kind and its URL handle. */
export const PRESET_HANDLE = new RegExp(`^(${HANDLE_KINDS.join("|")}):([a-z0-9]+(?:-[a-z0-9]+)*)$`)

/** An image beside the preset: in `images/`, a plain name, one of three types. */
export const PRESET_IMAGE_PATH = /^images\/[a-z0-9]+(?:-[a-z0-9]+)*\.(?:webp|jpg|png)$/

export const PRESET_IMAGES_DIR = "images"
export const PRESET_PREVIEW = "preview.webp"

const KIB = 1024
const MIB = 1024 * KIB

/**
 * How much a preset carries: every image ships in the release's image
 * (adr/0063 Sonuçlar, F16), and each still goes through the shop's upload
 * line, whose own limit is higher.
 */
export const PRESET_LIMITS = {
  presets: 20,
  images: 24,
  imageBytes: 2 * MIB,
  imagesBytes: 16 * MIB,
  previewBytes: 256 * KIB,
  sections: 30,
  menus: 10,
  menuLinks: 30,
  menuChildren: 20,
  demoRecords: 200,
} as const

// Plain text: no control characters
const plain = (max: number) =>
  z
    .string()
    .trim()
    .min(1)
    .max(max)
    // eslint-disable-next-line no-control-regex
    .refine((value) => !/[\u0000-\u001f\u007f]/.test(value), { message: "not plain text" })

/** A path on the shop: one leading slash, no `//`, no backslash or whitespace (as the backend's). */
const isShopPath = (value: string): boolean =>
  value.length <= 512 &&
  value.startsWith("/") &&
  !value.startsWith("//") &&
  !value.includes("\\") &&
  !/\s/.test(value)

const isHttpsUrl = (value: string): boolean => {
  if (value.length > 2048 || /\s/.test(value)) {
    return false
  }
  try {
    const url = new URL(value)
    return url.protocol === "https:" && url.username === "" && url.password === ""
  } catch {
    return false
  }
}

/** Where a link goes: a path on the shop (a record's, a storefront page's) or an https address. */
export const presetHref = z.string().refine((value) => isShopPath(value) || isHttpsUrl(value), {
  message: "not a shop path or an https address",
})

/** A record by its kind and handle, in place of its id. */
export const handleRef = z.strictObject({ $handle: z.string().max(110).regex(PRESET_HANDLE) })

/** One of the preset's images, in place of a media library address. */
export const imageRef = z.strictObject({
  $image: z.string().regex(PRESET_IMAGE_PATH),
  alt: plain(300).nullable().optional(),
})

/** A link written as an address, in place of a link to a record; none: the theme's wording. */
export const hrefRef = z.strictObject({
  $href: presetHref,
  label: plain(60).nullable().optional(),
})

export const presetManifestSchema = z.strictObject({
  format: z.literal(PRESET_FORMAT),
  code: z.string().regex(PRESET_CODE),
  /** Raised when the preset changes; the pack's version is raised with it. */
  version: z.number().int().min(1).max(10_000),
  theme: z.string().regex(THEME_CODE),
  /** Turkish, as the gallery shows it. */
  name: plain(80),
  description: plain(400),
  /** The gallery's label only: the page's ground stays the theme's. */
  tone: z.enum(["light", "dark"]),
  /** Where each image comes from and under what licence (adr/0063, owner's decision 7). */
  credits: z
    .array(
      z.strictObject({
        file: z.string().regex(PRESET_IMAGE_PATH),
        source: plain(300),
        license: plain(200),
      })
    )
    .max(PRESET_LIMITS.images)
    .default([]),
})

/** The theme section's fields; the backend's `themeSection.full` decides them, contrast included. */
export const presetThemeSchema = z.looseObject({ theme: z.string().regex(THEME_CODE) })

/** A section as far as the frame goes: its fixed id and its type; the backend checks the rest. */
const sectionFrame = z.looseObject({
  id: z.string().regex(/^[a-z0-9]{6,24}$/),
  type: z.string().regex(/^[a-z][a-z_]{0,39}$/),
})
const group = z.array(sectionFrame).max(PRESET_LIMITS.sections).optional()

/**
 * The design document's page groups. Its `settings` are not the preset's:
 * the theme comes from `theme.json`, the menus from `menus.json`, the
 * applied preset is written when applied, and the trust badges, colour
 * swatches and "Az kaldı" are the shop's own (adr/0063 §4).
 */
export const presetLayoutSchema = z.strictObject({
  header: group,
  home: group,
  footer: group,
  product: group,
  category: group,
})

const menuLink = { label: plain(60), href: presetHref }

/** A menu as a shop profile writes it: links as addresses. */
export const presetMenuSchema = z.strictObject({
  title: plain(60),
  location: z.enum(["main", "top", "footer"]),
  items: z
    .array(
      z.strictObject({
        ...menuLink,
        children: z.array(z.strictObject(menuLink)).max(PRESET_LIMITS.menuChildren).optional(),
      })
    )
    .max(PRESET_LIMITS.menuLinks),
})

const records = z.array(z.record(z.string(), z.unknown())).max(PRESET_LIMITS.demoRecords).optional()

/** Demo records, made by the backend's own create schemas (adr/0063 §5). */
export const presetDemoSchema = z.strictObject({
  products: records,
  collections: records,
  brands: records,
  pages: records,
})

/** The JSON files a preset's folder may hold; with `images/` and `preview.webp`, nothing else. */
export const PRESET_FILES = {
  "preset.json": presetManifestSchema,
  "theme.json": presetThemeSchema,
  "layout.json": presetLayoutSchema,
  /** None: the shop's menus are left alone; an empty set is not written. */
  "menus.json": z.array(presetMenuSchema).min(1).max(PRESET_LIMITS.menus),
  "demo.json": presetDemoSchema,
} as const

export type PresetManifest = z.infer<typeof presetManifestSchema>
export type PresetLayout = z.infer<typeof presetLayoutSchema>
export type PresetMenu = z.infer<typeof presetMenuSchema>
export type PresetDemo = z.infer<typeof presetDemoSchema>

/** A preset as read: its manifest, its files' data with references unresolved, its images. */
export interface StorefrontPreset extends Omit<PresetManifest, "format"> {
  /** The pack it belongs to. */
  pack: string
  /** Its folder on disk: image and preview paths are relative to it. */
  dir: string
  /** `theme.json`. */
  theme_settings: Record<string, unknown>
  layout: PresetLayout
  /** None: the preset leaves the shop's menus alone. */
  menus: PresetMenu[] | null
  demo: PresetDemo | null
  /** Every image, each used by a `$image`, by its path (`images/hero.webp`). */
  images: { path: string; bytes: number }[]
  /** `preview.webp` when it has one. */
  preview: string | null
  /** Every `$handle` it names, once each, as written. */
  handles: string[]
}
