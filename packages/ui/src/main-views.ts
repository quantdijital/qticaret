import type {
  CategoryMainVariant,
  FooterBarStep,
  FooterColumnsStep,
  FooterBarVariant,
  HeaderBarVariant,
  HeaderMenuGround,
  HeaderMenuImages,
  HeaderSearchStyle,
  HeaderSearchWidth,
  HeaderToolsPlace,
  HeaderTopLinksPlace,
  ProductMainVariant,
} from "@qticaret/types"
import type { SectionLookView } from "./content-views"
import type { FooterRowView, FooterRowsView } from "./footer-rows-views"
import type { ShopMarkView } from "./card-views"
import type { ImageView, LinkView, NavCategoryView } from "./views"

/**
 * The main sections as a theme draws them (adr/0049 Ek 2026-11-14 §5, §7):
 * the shop's header bar (`ShopView.headerBar`), its footer
 * (`ShopView.footerBar`), the product's own block (`ProductPageView.main`)
 * and the category's product grid (`ListingPageView.main`). Each names its
 * variant; a theme draws the ones it has and the default for the rest
 * (`drawnVariant`), its fields of that variant left unread. The id is the
 * section's own (its box).
 */
export interface HeaderBarView {
  id: string
  variant: HeaderBarVariant
  /** The header stays at the top of a long page. */
  sticky: boolean
  /**
   * Where the menus show the categories' small pictures (adr/0049 Ek
   * 2026-11-15): `all` the "Kategoriler" list too, `submenus` the
   * dropdowns and the phone's sheet only (the drawing from before), `off`
   * none; absent: `submenus`.
   */
  menuImages?: HeaderMenuImages
  /**
   * How the search stands (adr/0049 Ek 2026-11-15): `field`, the box drawn
   * open (the drawing from before); `icon`, a magnifier that opens it from
   * 1024 px, and on a phone none in the header (the bottom bar's "Ara"
   * drops it down). Absent: `field`.
   */
  searchStyle?: HeaderSearchStyle
  /** The `catalog` variant's own settings (adr/0049 N14); absent on the others. */
  catalog?: HeaderCatalogView
  /**
   * The other variants' action button (the catalog's is `catalog.highlight`):
   * from 1024 px after the tools, on a phone first in the menu sheet; absent
   * or null: none, drawn as before it.
   */
  highlight?: LinkView | null
}

/**
 * The catalog header (adr/0049 Ek 2026-11-14 N14, Ek 2026-11-15): a
 * utility strip over the wordmark, a wide search and the shop's phone,
 * then a filled menu bar with a "Kategoriler" button, the main menu, a
 * highlighted last link and the icons. On a phone the theme's phone header
 * stays as it is.
 */
export interface HeaderCatalogView {
  /** The search box's words; null: the theme's own. */
  searchPlaceholder: string | null
  /** The search button written ("Ara") rather than a magnifier. */
  searchLabel: boolean
  /** "Hesabım" written at the utility strip's end (beside the bar's icons; `toolsPlace` `bar`). */
  accountText: boolean
  /** The cart's subtotal beside its icon (when the cart holds something). */
  cartTotal: boolean
  /** The menu bar's highlighted last link; null: none. */
  highlight: LinkView | null
  /** The thin strip above the header: the shop's top links and the account link. */
  utilityBar: boolean
  /** The shop's phone beside the search (`ShopView.contact.phone`); none there: not drawn. */
  phone: boolean
  /** The shop's top categories with their children for "Kategoriler"; empty: no button. */
  categories: NavCategoryView[]
  /** The menu bar's ground: "Koyu / Ana renk / Açık". */
  menuGround: HeaderMenuGround
  /**
   * Account, favourites and the cart (Ek 2026-11-15): `bar`, the menu
   * bar's icons; `row`, named beside the shop's phone (the account once:
   * the strip writes no "Hesabım" then). Absent: `bar`.
   */
  toolsPlace?: HeaderToolsPlace
  /**
   * The shop's top links: `strip`, in the thin strip (none while
   * `utilityBar` is off); `bar`, quiet words at the menu bar's end, under
   * "Daha fazla" when the categories need the room. Absent: `strip`.
   */
  topLinksPlace?: HeaderTopLinksPlace
  /** The search: `wide`; `narrow`, 35 rem at most right after the wordmark. Absent: `wide`. */
  searchWidth?: HeaderSearchWidth
  /**
   * The strip's short note at its start (Ek 2026-11-15), plain words, and
   * where it goes (null: not a link). Absent or null: no note, the strip
   * as drawn before it.
   */
  stripNote?: { text: string; path: string | null } | null
}

export interface FooterBarView {
  id: string
  variant: FooterBarVariant
  /**
   * The footer's own settings (adr/0049 Ek 2026-11-15). How the shop's
   * profiles show; absent: written, as before.
   */
  social?: FooterBarStep<"social">
  /**
   * The ways to pay the shop names, in its order, each its key and words:
   * the ledger draws the words in a small framed box; the brand columns
   * footer draws a card network's own mark (`logo`, the storefront's
   * `/marks/` file) and the others' words. None (or absent): the
   * providers' marks, as before.
   */
  paymentBadges?: ShopMarkView[]
  /** The `brand_columns` footer's own settings (adr/0049 Ek 2026-11-17); absent on the others. */
  columns?: FooterColumnsView
  /** The `free_rows` footer's own settings (adr/0070); absent on the others. */
  freeRows?: FooterRowsView
  /** The `free_rows` footer's rows, their blocks resolved; absent on the others. */
  rows?: FooterRowView[]
  /** The floating "back to top" button; none (or absent): not drawn. */
  backToTop?: BackToTopView | null
  /**
   * The store profile's logo, naming the shop over its contact as the
   * header's does (owner 2026-11-16); absent (no logo): its name.
   */
  logo?: ImageView
}

/** The brand columns footer's own settings, each read forgivingly (a step off its list: the default). */
export interface FooterColumnsView {
  /** The strip above the columns: the newsletter box and the shop's ways to reach it. */
  topStrip: boolean
  /** A short line about the shop under its name; null: none. */
  about: string | null
  ground: FooterColumnsStep<"ground">
  badgeStyle: FooterColumnsStep<"badge_style">
}

export interface BackToTopView {
  side: FooterBarStep<"back_to_top_side">
  shape: FooterBarStep<"back_to_top_shape">
  /** Shown on a phone too. */
  mobile: boolean
}

export interface ProductMainView {
  id: string
  variant: ProductMainVariant
  /**
   * The gallery's picture shape the shop chose: `landscape` 4:3 or
   * `portrait` 3:4; absent: the square (the page as drawn before it).
   */
  imageRatio?: "landscape" | "portrait"
  /** The steps the shop set (adr/0049 Ek 2026-11-14 §6); absent: the theme's own drawing. */
  look?: SectionLookView
}

export interface CategoryMainView {
  id: string
  variant: CategoryMainVariant
  look?: SectionLookView
}
