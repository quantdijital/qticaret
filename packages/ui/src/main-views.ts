import type {
  CategoryMainVariant,
  FooterBarStep,
  FooterBarVariant,
  HeaderBarVariant,
  HeaderMenuGround,
  HeaderMenuImages,
  ProductMainVariant,
} from "@qticaret/types"
import type { SectionLookView } from "./content-views"
import type { LinkView, NavCategoryView } from "./views"

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
  /** The `catalog` variant's own settings (adr/0049 N14); absent on the others. */
  catalog?: HeaderCatalogView
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
  /** "Hesabım" written at the utility strip's end. */
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
   * drawn as the words in a small framed box, never a company's mark.
   * None (or absent): the providers' marks, as before.
   */
  paymentBadges?: { key: string; label: string }[]
  /** The floating "back to top" button; none (or absent): not drawn. */
  backToTop?: BackToTopView | null
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
  /** The steps the shop set (adr/0049 Ek 2026-11-14 §6); absent: the theme's own drawing. */
  look?: SectionLookView
}

export interface CategoryMainView {
  id: string
  variant: CategoryMainVariant
  look?: SectionLookView
}
