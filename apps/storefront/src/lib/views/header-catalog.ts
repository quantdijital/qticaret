import type { StoreHeaderCatalog } from "@qticaret/types"
import {
  headerMenuGroundOf,
  headerSearchWidthOf,
  headerToolsPlaceOf,
  headerTopLinksPlaceOf,
} from "@qticaret/types/section-variants"
import type { HeaderCatalogView, NavCategoryView, Translate } from "@qticaret/ui"
import { menuLink } from "./menus"

/** What a catalog header without its settings (an older answer) is drawn with: the backend's defaults. */
const DEFAULTS: StoreHeaderCatalog = {
  search_placeholder: null,
  search_label: false,
  account_text: true,
  cart_total: false,
  highlight_link: null,
  utility_bar: true,
  phone: true,
  categories_button: true,
  menu_ground: "stage",
}

/**
 * The catalog header's settings as the theme draws them (adr/0049 Ek
 * 2026-11-15): the highlighted link as a link view (a storefront page's
 * name in the storefront's words; none without a name and an address),
 * the "Kategoriler" list only when its button shows, the shop's top
 * categories (`tree`, built from the categories the frame already read:
 * no request of its own); each layout choice the answer lacks (an older
 * backend) or names off its list, today's drawing; the strip's note.
 */
export function headerCatalogOf(
  catalog: StoreHeaderCatalog | undefined,
  t: Translate,
  tree: () => NavCategoryView[]
): HeaderCatalogView {
  const set = catalog ?? DEFAULTS
  return {
    searchPlaceholder: set.search_placeholder,
    searchLabel: set.search_label,
    accountText: set.account_text,
    cartTotal: set.cart_total,
    highlight: set.highlight_link ? menuLink({ ...set.highlight_link, children: [] }, t) : null,
    utilityBar: set.utility_bar,
    phone: set.phone,
    categories: set.categories_button ? tree() : [],
    menuGround: headerMenuGroundOf(set.menu_ground),
    toolsPlace: headerToolsPlaceOf(set.tools_place),
    topLinksPlace: headerTopLinksPlaceOf(set.top_links),
    searchWidth: headerSearchWidthOf(set.search_width),
    stripNote: stripNoteOf(set, t),
  }
}

/**
 * The strip's note (Ek 2026-11-15): its words, and the link's path when it
 * has one (a broken link, one without an address: plain words).
 * None, blank or not words at all (an older or odd answer): no note.
 */
function stripNoteOf(
  set: StoreHeaderCatalog,
  t: Translate
): NonNullable<HeaderCatalogView["stripNote"]> | null {
  const text = typeof set.strip_note === "string" ? set.strip_note.trim() : ""
  if (text === "") {
    return null
  }
  // The note's own words name the link: only where it goes is read
  const link = set.strip_note_link
    ? menuLink({ ...set.strip_note_link, label: text, children: [] }, t)
    : null
  return { text, path: link?.path ?? null }
}
