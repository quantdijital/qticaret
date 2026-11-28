import {
  HEADER_MENU_GROUNDS,
  HEADER_SEARCH_WIDTHS,
  HEADER_TOOLS_PLACES,
  HEADER_TOP_LINKS_PLACES,
} from "@qticaret/types"
import type { HeaderCatalogFields } from "@/features/storefront/api/layout"

/**
 * The catalog header's settings told as named steps (adr/0049 Ek
 * 2026-11-15), each with the contract's list, its first the default: the
 * menu bar's ground and the layout choices. The form and the settings
 * search read them from here.
 */
export const HEADER_CATALOG_STEPS = {
  menu_ground: HEADER_MENU_GROUNDS,
  search_width: HEADER_SEARCH_WIDTHS,
  top_links: HEADER_TOP_LINKS_PLACES,
  tools_place: HEADER_TOOLS_PLACES,
} as const satisfies Partial<Record<keyof HeaderCatalogFields, readonly string[]>>

export type HeaderCatalogStepField = keyof typeof HEADER_CATALOG_STEPS

export const isHeaderCatalogStep = (field: string): field is HeaderCatalogStepField =>
  field in HEADER_CATALOG_STEPS

/**
 * The catalog settings of the strip the header drew above itself until the
 * top strip became its own section (owner's decision 2026-11-27, adr/0066
 * Ek): kept as stored, read once into the strip section, never offered.
 */
const STRIP_FIELDS: ReadonlySet<keyof HeaderCatalogFields> = new Set([
  "utility_bar",
  "strip_note",
  "strip_note_link",
  "account_text",
])

/**
 * Whether the panel offers a catalog setting as the bar stands
 * (bilesen-standardi §0, "geniş düşün, az göster"): never one of the old
 * strip's (`STRIP_FIELDS`); the rest always.
 */
export function headerCatalogOffers(
  _section: Pick<HeaderCatalogFields, "tools_place" | "utility_bar">,
  field: keyof HeaderCatalogFields
): boolean {
  return !STRIP_FIELDS.has(field)
}
