export {
  PACK_CODE,
  PACK_FORMAT,
  PACK_FILES,
  attributeTemplateSchema,
  categorySchema,
  flagPresetSchema,
  manifestSchema,
  seoTemplateSetSchema,
} from "./schema"
export type {
  AttributeTemplateData,
  CategoryData,
  FlagPreset,
  LoadedSectorPack,
  PackManifest,
  SectorPack,
  SectorPackSummary,
  SeoTemplateSet,
} from "./schema"
export {
  HANDLE_KINDS,
  PRESET_CODE,
  PRESET_FILES,
  PRESET_FORMAT,
  PRESET_HANDLE,
  PRESET_IMAGE_PATH,
  PRESET_LIMITS,
  PRESET_PREVIEW,
  handleRef,
  hrefRef,
  imageRef,
  presetManifestSchema,
} from "./preset-schema"
export type {
  HandleKind,
  PresetDemo,
  PresetLayout,
  PresetManifest,
  PresetMenu,
  StorefrontPreset,
} from "./preset-schema"
export { PRESETS_DIR, readPreset } from "./preset-load"
export {
  DEFAULT_PACKS_DIR,
  SectorPackError,
  isSectorPackCode,
  readPack,
  sectorPack,
  sectorPacks,
  storefrontPreset,
  summaryOf,
} from "./load"

/**
 * An item's stable name in a shop (adr/0061 C12): the shop records each
 * pack item it was offered by this name, so a re-apply, of this version
 * or a newer one, never offers it again. A handle or key is never
 * renamed in a pack; a new one is a new item.
 */
export const packItemKey = {
  template: (handle: string) => `attribute_template:${handle}`,
  attribute: (handle: string, key: string) => `attribute:${handle}/${key}`,
  category: (handle: string) => `category:${handle}`,
  flag: (key: string) => `flag:${key}`,
  seo: (group: string, entity: string) => `seo:${group}.${entity}`,
  /** A preset's image uploaded to the shop's media library (adr/0063 §4), by its path (`images/hero.webp`). */
  presetImage: (preset: string, path: string) => `preset_image:${preset}/${path}`,
} as const
