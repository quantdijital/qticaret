import { z } from "zod"
import type { StorefrontPreset } from "./preset-schema"

/**
 * A sector pack's files as this package reads them (adr/0061 F17.7, C12).
 * The package owns the pack's frame: its manifest, which files it has,
 * handles, keys and the order of a category tree. What an item holds is
 * the shop's to judge: the backend checks every template, flag and SEO
 * template with its own schemas (the ones its panel's saves go through)
 * before anything is applied, and its tests check every pack the same way.
 */

export const PACK_FORMAT = "quant-sector-pack"

/** A pack's code: its folder's name, the control plane's `tenant.sector_pack`. */
export const PACK_CODE = /^[a-z][a-z0-9-]{1,39}$/

// As the backend's attribute template handle and a category's URL handle
const HANDLE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
// As the backend's attribute definition key
const KEY = /^[a-z][a-z0-9_]{0,63}$/
// A feature flag's key (adr/0012: `area.name`)
const FLAG_KEY = /^[a-z][a-z0-9_]*(?:\.[a-z0-9_]+)+$/
// An SEO template's entity (`product`, `brand`...)
const ENTITY = /^[a-z][a-z_]{0,31}$/

const handle = z.string().max(100).regex(HANDLE)

export const manifestSchema = z.strictObject({
  format: z.literal(PACK_FORMAT),
  code: z.string().regex(PACK_CODE),
  /** Raised when the pack gains items; a re-apply adds only what a shop never had. */
  version: z.number().int().min(1).max(10_000),
  /** Turkish, as the wizard shows it. */
  name: z.string().trim().min(1).max(80),
  description: z.string().trim().min(1).max(400),
})

/**
 * An attribute template: the backend's `AdminPostAttributeTemplate`
 * (adr/0013) decides everything else in it, unknown keys included.
 */
export const attributeTemplateSchema = z.looseObject({
  handle,
  name: z.string().trim().min(1).max(200),
  definitions: z.array(z.looseObject({ key: z.string().regex(KEY) })).max(100),
})

/**
 * A suggested category: made hidden from the storefront (a category is shown
 * with its image), under its parent, which comes earlier in the list.
 */
export const categorySchema = z.strictObject({
  handle,
  name: z.string().trim().min(1).max(100),
  parent: handle.optional(),
  description: z.string().trim().min(1).max(1000).optional(),
})

/** A shop-owned flag's starting value (adr/0012 `owner: tenant`); the backend's registry checks it. */
export const flagPresetSchema = z.strictObject({
  key: z.string().max(100).regex(FLAG_KEY),
  enabled: z.boolean(),
})

const templates = z.record(z.string().regex(ENTITY), z.string().min(1).max(300))

/** Title and description templates (docs/13 §3) by entity; the backend's SEO section checks them. */
export const seoTemplateSetSchema = z.strictObject({
  title_templates: templates.optional(),
  description_templates: templates.optional(),
})

/** The most scenes a pack offers: the AI core's two ready-made options (adr/0071 §2). */
export const MAX_SCENES = 2

/** A scene's code: the AI core's option name (`api/admin/ai/validators.ts`). */
export const SCENE_CODE = /^[a-z][a-z0-9_]{0,39}$/

// One line of plain words: no control character, no markup, no template braces
const PLAIN_LINE = /^[^\p{Cc}<>{}`\\]+$/u

const sceneName = z.string().trim().min(1).max(60).regex(PLAIN_LINE)

/**
 * A ready-made scene a product photo can be set in (docs/22 Aşama 7). The
 * name is what the panel's picker shows (Turkish and English); the prompt
 * is the setting described in English, which the AI core wraps in its own
 * fixed instruction (keep the product as it is). Only this text reaches a
 * service: nothing typed by a shop. Read at run time, never applied.
 */
export const sceneSchema = z.strictObject({
  code: z.string().regex(SCENE_CODE),
  name: z.strictObject({ tr: sceneName, en: sceneName }),
  prompt: z.string().trim().min(20).max(400).regex(PLAIN_LINE),
})

/**
 * The files a pack's folder may hold, and what each is; any other file is
 * refused, but for the `presets/` folder (`PRESETS_DIR`, `preset-load.ts`).
 */
export const PACK_FILES = {
  "manifest.json": manifestSchema,
  "attributes.json": z.array(attributeTemplateSchema).max(50),
  "categories.json": z.array(categorySchema).max(200),
  "flags.json": z.array(flagPresetSchema).max(50),
  "seo.json": seoTemplateSetSchema,
  "scenes.json": z.array(sceneSchema).max(MAX_SCENES),
} as const

export type PackManifest = z.infer<typeof manifestSchema>
export type AttributeTemplateData = z.infer<typeof attributeTemplateSchema>
export type CategoryData = z.infer<typeof categorySchema>
export type FlagPreset = z.infer<typeof flagPresetSchema>
export type SeoTemplateSet = z.infer<typeof seoTemplateSetSchema>
export type SceneData = z.infer<typeof sceneSchema>

/** A pack as read: its manifest and its items (a file left out: none of that kind). */
export interface SectorPack extends Omit<PackManifest, "format"> {
  attribute_templates: AttributeTemplateData[]
  categories: CategoryData[]
  flags: FlagPreset[]
  seo: SeoTemplateSet
}

/**
 * A pack as read from disk: its items and its storefront presets
 * (`presets/`, adr/0063 §2). Applying a pack never applies a preset; a
 * preset is applied on its own, by the shop or at setup.
 */
export interface LoadedSectorPack extends SectorPack {
  presets: readonly StorefrontPreset[]
  /** The AI scenes it offers (`scenes.json`, at most two); read where asked, never applied. */
  scenes: readonly SceneData[]
}

/** What the control plane's wizard shows of a pack. */
export interface SectorPackSummary {
  code: string
  version: number
  name: string
  description: string
  counts: {
    attribute_templates: number
    attributes: number
    categories: number
    flags: number
    seo_templates: number
    presets: number
  }
}
