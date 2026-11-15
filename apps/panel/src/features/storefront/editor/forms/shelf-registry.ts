import { SCROLLER_SETTINGS, scrollerSettingsOf } from "@qticaret/types"
import type { ScrollerSetting } from "@qticaret/types"
import type { AnySection } from "@/features/storefront/api/layout"
import type { RegistryField } from "./field-registry"
import { SCROLLER_MAIN, scrollerOffers } from "./scroller-groups"

// A product rail's fields for the settings search (adr/0049 Ek 2026-11-15), beside
// `field-registry.ts`'s, built from what `ShelfGroups` and `ScrollerFields` show

/** A product rail's "Diziliş" fields beside its variant (adr/0049 Ek 2026-11-15). */
export type ShelfField = "columns" | "rows" | "per_list" | "card_variant"

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
    variant === "grid" ? field("columns", "storefront.editor.fields.columns", null) : null,
    variant === "compact" ? field("rows", `${SHELF}.rows`, `${SHELF}.rowsTerm`) : null,
    variant === "columns" ? field("per_list", `${SHELF}.perList`, `${SHELF}.perListTerm`) : null,
    variant === "compact" || variant === "columns"
      ? null
      : field("card_variant", "storefront.editor.products.cardVariant", null),
  ].filter((each) => each !== null)
  if (variant !== "carousel") {
    return fields
  }
  const settings = scrollerSettingsOf(section.scroller)
  for (const [setting, steps] of Object.entries(SCROLLER_SETTINGS) as [
    ScrollerSetting,
    readonly string[],
  ][]) {
    if (scrollerOffers(settings, setting)) {
      fields.push({
        key: `scroller.${setting}`,
        group: SCROLLER_MAIN.includes(setting) ? "scroll" : "look",
        label: `${SCROLLER}.${setting}.label`,
        term: `${SCROLLER}.${setting}.term`,
        options: steps.map((step) => `${SCROLLER}.${setting}.${step}`),
        target: SHELF_IDS.scroller(id, setting),
      })
    }
  }
  return fields
}
