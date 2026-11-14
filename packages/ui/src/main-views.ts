import type {
  CategoryMainVariant,
  FooterBarVariant,
  HeaderBarVariant,
  ProductMainVariant,
} from "@qticaret/types"
import type { SectionLookView } from "./content-views"

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
}

export interface FooterBarView {
  id: string
  variant: FooterBarVariant
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
