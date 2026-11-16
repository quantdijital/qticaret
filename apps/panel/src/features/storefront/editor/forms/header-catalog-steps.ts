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
 * Whether the panel offers a catalog setting as the bar stands
 * (bilesen-standardi §0, "geniş düşün, az göster"): the strip's written
 * "Hesabım" only while the tools stand on the menu bar (in the top row
 * they carry it), the strip's note and its link only while the strip is
 * on. The strip itself is always offered: its note may be all it holds.
 */
export function headerCatalogOffers(
  section: Pick<HeaderCatalogFields, "tools_place" | "utility_bar">,
  field: keyof HeaderCatalogFields
): boolean {
  if (field === "account_text") {
    return section.tools_place !== "row"
  }
  if (field === "strip_note" || field === "strip_note_link") {
    return section.utility_bar
  }
  return true
}
