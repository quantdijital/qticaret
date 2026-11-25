import type { StoreFooterBarSettings, StoreFooterColumns } from "./section-footer.js"
import type { StoreFooterRows } from "./section-footer-rows.js"
import type { StoreLayoutLink } from "./layout.js"
import type { SectionLook } from "./section-look.js"
import type {
  CategoryMainVariant,
  FooterBarVariant,
  HeaderBarVariant,
  HeaderMenuGround,
  HeaderMenuImages,
  HeaderSearchStyle,
  HeaderToolsStyle,
  HeaderSearchWidth,
  HeaderToolsPlace,
  HeaderTopLinksPlace,
  ProductImageRatio,
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
 * "Kategoriler" button and the menu bar's ground; where its tools and the
 * shop's top links stand and how wide its search is; the strip's note.
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
  /**
   * The layout choices (Ek 2026-11-15, `HEADER_TOOLS_PLACES`,
   * `HEADER_TOP_LINKS_PLACES`, `HEADER_SEARCH_WIDTHS`); an older backend
   * prints none: a reader takes each list's first (today's drawing).
   */
  tools_place?: HeaderToolsPlace
  top_links?: HeaderTopLinksPlace
  search_width?: HeaderSearchWidth
  /**
   * The strip's note (Ek 2026-11-15): a short plain line at its start
   * (`HEADER_CATALOG_LIMITS.strip_note`) and where it goes, placed as the
   * highlighted link is (a broken one null: the note stays plain words).
   * An older backend prints neither: no note.
   */
  strip_note?: string | null
  strip_note_link?: StoreLayoutLink | null
}

export interface StoreMainSections {
  header_bar: {
    id: string
    type: "header_bar"
    variant: HeaderBarVariant
    /** The header stays at the top of a long page. */
    sticky: boolean
    /**
     * Where the menus show the categories' pictures (adr/0049 Ek
     * 2026-11-15; `HEADER_MENU_IMAGES`), every variant's; an older backend
     * prints none: a reader takes `submenus` (`headerMenuImagesOf`).
     */
    menu_images?: HeaderMenuImages
    /**
     * How the search stands (`HEADER_SEARCH_STYLES`), every variant's; an
     * older backend prints none: a reader takes `field` (`headerSearchStyleOf`).
     */
    search_style?: HeaderSearchStyle
    /** The one-row header's tools (`HEADER_TOOLS_STYLES`); absent: `round`. */
    tools_style?: HeaderToolsStyle
    /** The `catalog` variant's own settings; absent on the others. */
    catalog?: StoreHeaderCatalog
    /**
     * The action button of the variants other than `catalog` (whose
     * `catalog.highlight_link` it is): its words and where it goes; absent
     * while none is set (an older backend too), null when broken. None: no button.
     */
    highlight_link?: StoreLayoutLink | null
  }
  /**
   * The footer with its own settings (adr/0049 Ek 2026-11-15); an older
   * backend prints none: a reader takes `FOOTER_BAR_DEFAULTS`.
   */
  footer_bar: {
    id: string
    type: "footer_bar"
    variant: FooterBarVariant
    /** The `brand_columns` variant's own settings (adr/0049 Ek 2026-11-17); absent on the others. */
    columns?: StoreFooterColumns
  } & Partial<StoreFooterBarSettings> &
    /** The `free_rows` variant's own settings and rows (adr/0070), all of them; absent on the others. */
    Partial<StoreFooterRows>
  product_main: {
    id: string
    type: "product_main"
    variant: ProductMainVariant
    /** The gallery's picture shape; left out: the square (an older backend, or the shop left it). */
    image_ratio?: ProductImageRatio
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
