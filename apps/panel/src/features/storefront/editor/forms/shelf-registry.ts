import {
  SCROLLER_DEFAULTS,
  SCROLLER_SETTINGS,
  SHELF_STRIPS_SETTINGS,
  SHELF_STRIPS_SETTING_NAMES,
  SLIDER_SCROLLER,
  scrollerSettingsOf,
  sliderSettingsOf,
} from "@qticaret/types"
import type {
  ScrollerSetting,
  ScrollerSettings,
  ShelfStripsSetting,
  SliderSettings,
  SliderSource,
} from "@qticaret/types"
import type { AnySection } from "@/features/storefront/api/layout"
import type { RegistryField } from "./field-registry"
import { SCROLLER_MAIN, SLIDER_MAIN, scrollerOffers } from "./scroller-groups"

// A product rail's fields for the settings search (adr/0049 Ek 2026-11-15), beside
// `field-registry.ts`'s, built from what `ShelfGroups` and `ScrollerFields` show

/** A product rail's "Diziliş" fields beside its variant (adr/0049 Ek 2026-11-15, 2026-11-16). */
export type ShelfField =
  | "columns"
  | "columns_mobile"
  | "rows"
  | "per_list"
  | "strips_count"
  | ShelfStripsSetting
  | "card_variant"
  | "tabs"

/** A strips rail's steps and switches in the panel's order (`ShelfStripsFields`). */
export const SHELF_STRIPS_STEPS = [
  "strips_height",
  "strips_slant",
  "strips_line",
] as const satisfies readonly ShelfStripsSetting[]
export const SHELF_STRIPS_SWITCHES = [
  "strips_overlap",
  "strips_dim",
] as const satisfies readonly ShelfStripsSetting[]

const GALLERY = "storefront.editor.stripGallery"

/**
 * Each strips setting's words: the look keeps the strip gallery's (one set
 * of names wherever the shop meets the strips), the height is the rail's own.
 */
export const SHELF_STRIPS_LABELS: Readonly<Record<ShelfStripsSetting, string>> = {
  strips_height: "storefront.editor.shelf.stripsHeight",
  strips_slant: `${GALLERY}.strips_slant`,
  strips_line: `${GALLERY}.strips_line`,
  strips_overlap: `${GALLERY}.strips_overlap`,
  strips_dim: `${GALLERY}.strips_dim`,
}

/** A strips step's everyday name: the strip gallery's, the height's too. */
export const stripsStepKey = (name: ShelfStripsSetting, step: string) =>
  name === "strips_height" ? `${GALLERY}.height.${step}` : `${GALLERY}.${name}.${step}`

/** The rail's and the scroller's elements' ids (spread into `FIELD_IDS`). */
export const SHELF_IDS = {
  shelf: (sectionId: string, field: ShelfField) => `${sectionId}-shelf-${field}`,
  scroller: (sectionId: string, setting: ScrollerSetting) => `${sectionId}-scroller-${setting}`,
} as const

const SHELF = "storefront.editor.shelf"
const SCROLLER = "storefront.editor.scroller"

/** A product rail's fields beside its variant, as its variant shows them (`ShelfGroups`). */
export function shelfFields(section: Extract<AnySection, { type: "products" }>): RegistryField[] {
  const id = section.id
  const field = (key: ShelfField, label: string, term: string | null): RegistryField => ({
    key,
    group: "layout",
    label,
    term,
    options: [],
    target: SHELF_IDS.shelf(id, key),
  })
  const { variant } = section
  const fields: RegistryField[] = [
    variant === "grid"
      ? field("columns", "storefront.editor.fields.columns", "storefront.editor.fields.columnsTerm")
      : null,
    variant === "grid"
      ? field(
          "columns_mobile",
          "storefront.editor.fields.columnsMobile",
          "storefront.editor.fields.columnsMobileTerm"
        )
      : null,
    variant === "compact" ? field("rows", `${SHELF}.rows`, `${SHELF}.rowsTerm`) : null,
    variant === "columns" ? field("per_list", `${SHELF}.perList`, `${SHELF}.perListTerm`) : null,
    ...(variant === "strips" ? stripsFields(id) : []),
    variant === "compact" || variant === "columns" || variant === "strips"
      ? null
      : field(
          "card_variant",
          "storefront.editor.products.cardVariant",
          "storefront.editor.products.cardVariantTerm"
        ),
    variant === "columns" ? null : field("tabs", `${SHELF}.tabs`, `${SHELF}.tabsTerm`),
  ].filter((each) => each !== null)
  return variant === "carousel" ? [...fields, ...scrollerFields(id, section.scroller)] : fields
}

/** A strips rail's count, height and look, in "Diziliş" as `ShelfGroups` shows them. */
function stripsFields(id: string): RegistryField[] {
  const count: RegistryField = {
    key: "strips_count",
    group: "layout",
    label: `${SHELF}.stripsCount`,
    term: `${SHELF}.stripsCountTerm`,
    options: [],
    target: SHELF_IDS.shelf(id, "strips_count"),
  }
  const look = SHELF_STRIPS_SETTING_NAMES.map((name): RegistryField => ({
    key: name,
    group: "layout",
    label: `${SHELF_STRIPS_LABELS[name]}.label`,
    term: `${SHELF_STRIPS_LABELS[name]}.term`,
    options: (SHELF_STRIPS_STEPS as readonly string[]).includes(name)
      ? SHELF_STRIPS_SETTINGS[name].map((step) => stripsStepKey(name, step))
      : [],
    target: SHELF_IDS.shelf(id, name),
  }))
  return [count, ...look]
}

/**
 * A carousel's scroller settings as the panel shows them (a product rail's or
 * the related products'): what is in view and the arrows open, the rest closed.
 */
export function scrollerFields(id: string, scroller: unknown): RegistryField[] {
  return kitFields(id, scrollerSettingsOf(scroller), Object.keys(SCROLLER_SETTINGS), SCROLLER_MAIN)
}

/**
 * The sliding opening's kit settings as the panel shows them
 * (bilesen-denetimi (b) 4, `SliderGroups`): turning, speed, arrows and
 * dots open, looping closed.
 */
export function sliderFields(
  id: string,
  section: SliderSource,
  defaults?: SliderSettings
): RegistryField[] {
  const settings = { ...SCROLLER_DEFAULTS, ...sliderSettingsOf(section, defaults) }
  return kitFields(id, settings, SLIDER_SCROLLER, SLIDER_MAIN)
}

/** Some of the kit's settings the row offers as it stands, open ones in "Kaydırma". */
function kitFields(
  id: string,
  settings: ScrollerSettings,
  names: readonly string[],
  open: readonly ScrollerSetting[]
): RegistryField[] {
  return (names as ScrollerSetting[])
    .filter((setting) => scrollerOffers(settings, setting))
    .map((setting) => ({
      key: `scroller.${setting}`,
      group: open.includes(setting) ? "scroll" : "look",
      label: `${SCROLLER}.${setting}.label`,
      term: `${SCROLLER}.${setting}.term`,
      options: SCROLLER_SETTINGS[setting].map((step) => `${SCROLLER}.${setting}.${step}`),
      target: SHELF_IDS.scroller(id, setting),
    }))
}
