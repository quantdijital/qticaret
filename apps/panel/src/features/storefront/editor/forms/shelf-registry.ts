import {
  SCROLLER_DEFAULTS,
  SCROLLER_SETTINGS,
  SLIDER_SCROLLER,
  scrollerSettingsOf,
  sliderSettingsOf,
} from "@qticaret/types"
import type { ScrollerSetting, ScrollerSettings, SliderSource } from "@qticaret/types"
import type { AnySection } from "@/features/storefront/api/layout"
import type { RegistryField } from "./field-registry"
import { SCROLLER_MAIN, SLIDER_MAIN, scrollerOffers } from "./scroller-groups"

// A product rail's fields for the settings search (adr/0049 Ek 2026-11-15), beside
// `field-registry.ts`'s, built from what `ShelfGroups` and `ScrollerFields` show

/** A product rail's "Diziliş" fields beside its variant (adr/0049 Ek 2026-11-15). */
export type ShelfField =
  "columns" | "columns_mobile" | "rows" | "per_list" | "card_variant" | "tabs"

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
    variant === "compact" || variant === "columns"
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
export function sliderFields(id: string, section: SliderSource): RegistryField[] {
  const settings = { ...SCROLLER_DEFAULTS, ...sliderSettingsOf(section) }
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
