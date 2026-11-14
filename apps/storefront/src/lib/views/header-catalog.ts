import type { StoreHeaderCatalog } from "@qticaret/types"
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
 * no request of its own).
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
    menuGround: set.menu_ground,
  }
}
