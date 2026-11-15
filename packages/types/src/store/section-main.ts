import type { StoreFooterBarSettings } from "./section-footer.js"
import type { StoreLayoutLink } from "./layout.js"
import type { SectionLook } from "./section-look.js"
import type {
  CategoryMainVariant,
  FooterBarVariant,
  HeaderBarVariant,
  HeaderMenuGround,
  ProductMainVariant,
} from "./section-variants.js"

/**
 * The main sections (adr/0049 Ek 2026-11-14 §5, §7; Shopify's "main"):
 * the shop's header bar, its footer, the product's own block and the
 * category's product grid, one each, always shown. A design saved before
 * them reads each with its default (the header bar's from the theme's
 * `header`). Each carries its id (the section's box) and its variant; a
 * theme draws the variants it has and the default for the rest
 * (`drawnVariant`). Types only: no runtime value lives here.
 */

/**
 * The catalog header's own settings (adr/0049 Ek 2026-11-14 N14, Ek
 * 2026-11-15): its search box's placeholder (null: the theme's words) and
 * written button, the written account link in the utility strip, the cart's
 * subtotal beside its icon, the highlighted last link of the menu bar (a
 * broken one null), the utility strip, the shop's phone number, the
 * "Kategoriler" button and the menu bar's ground.
 */
export interface StoreHeaderCatalog {
  search_placeholder: string | null
  search_label: boolean
  account_text: boolean
  cart_total: boolean
  highlight_link: StoreLayoutLink | null
  utility_bar: boolean
  phone: boolean
  categories_button: boolean
  menu_ground: HeaderMenuGround
}

export interface StoreMainSections {
  header_bar: {
    id: string
    type: "header_bar"
    variant: HeaderBarVariant
    /** The header stays at the top of a long page. */
    sticky: boolean
    /**
     * The menus' category pictures (adr/0049 Ek 2026-11-15): the
     * "Kategoriler" list, the menu's dropdowns and the phone's sheet, on
     * every variant; an older backend prints none: drawn.
     */
    menu_images?: boolean
    /** The `catalog` variant's own settings; absent on the others. */
    catalog?: StoreHeaderCatalog
  }
  /**
   * The footer with its own settings (adr/0049 Ek 2026-11-15); an older
   * backend prints none: a reader takes `FOOTER_BAR_DEFAULTS`.
   */
  footer_bar: {
    id: string
    type: "footer_bar"
    variant: FooterBarVariant
  } & Partial<StoreFooterBarSettings>
  product_main: {
    id: string
    type: "product_main"
    variant: ProductMainVariant
    look?: SectionLook
  }
  category_main: {
    id: string
    type: "category_main"
    variant: CategoryMainVariant
    /**
     * Each variant's own settings (§7: several category layouts are live at
     * once); a variant without one draws with its defaults. None so far.
     */
    by_variant: Record<string, never>
    look?: SectionLook
  }
}
