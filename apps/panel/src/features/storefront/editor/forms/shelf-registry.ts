import { SCROLLER_SETTINGS, scrollerSettingsOf } from "@qticaret/types"
import type { ScrollerSetting } from "@qticaret/types"
import type { AnySection } from "@/features/storefront/api/layout"
import type { RegistryField } from "./field-registry"
import { SCROLLER_MAIN, scrollerOffers } from "./scroller-groups"

// A product rail's fields for the settings search (adr/0049 Ek 2026-11-15), beside
// `field-registry.ts`'s, built from what `ShelfGroups` and `ScrollerFields` show

/** A product rail's "Diziliş" fields beside its variant (adr/0049 Ek 2026-11-15). */
export type ShelfField = "columns" | "columns_mobile" | "rows" | "per_list" | "card_variant"

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
  ].filter((each) => each !== null)
  return variant === "carousel" ? [...fields, ...scrollerFields(id, section.scroller)] : fields
}

/**
 * A carousel's scroller settings as the panel shows them (a product rail's or
 * the related products'): what is in view and the arrows open, the rest closed.
 */
export function scrollerFields(id: string, scroller: unknown): RegistryField[] {
  const settings = scrollerSettingsOf(scroller)
  return (Object.entries(SCROLLER_SETTINGS) as [ScrollerSetting, readonly string[]][])
    .filter(([setting]) => scrollerOffers(settings, setting))
    .map(([setting, steps]) => ({
      key: `scroller.${setting}`,
      group: SCROLLER_MAIN.includes(setting) ? "scroll" : "look",
      label: `${SCROLLER}.${setting}.label`,
      term: `${SCROLLER}.${setting}.term`,
      options: steps.map((step) => `${SCROLLER}.${setting}.${step}`),
      target: SHELF_IDS.scroller(id, setting),
    }))
}
