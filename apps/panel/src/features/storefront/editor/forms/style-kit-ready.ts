import type { StyleKitField } from "@qticaret/types"

/**
 * Which style kit fields the storefront draws yet (adr/0067 "Uygulama
 * notu"). The contract, the backend and the storefront's marks came first;
 * each field's drawing comes in its own step. Until then the field stays
 * out of the theme panel and its search: a choice that changes nothing
 * would mislead the shop. The step that draws a field turns its line on,
 * nothing else. One line each, a comment between, so two steps landing
 * at once do not touch the same lines.
 */
export const STYLE_KIT_READY: Readonly<Record<StyleKitField, boolean>> = {
  // S1, adr/0067 step 1: menu items (`data-menu-style`)
  menu_style: false,
  // S2, step 2: floating surfaces' shadow (`data-shadow`)
  shadow: false,
  // S3, step 3: chips, tabs, option buttons (`data-chip-style`)
  chip_style: false,
  // S4, step 5: the photos' ground (`data-media-ground`)
  media_ground: false,
}
