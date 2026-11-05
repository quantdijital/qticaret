import type { RatingBarView, SpecGroupView } from "./card-views"
import type { CardRatingView, ImageView, ProductCardView, SpecView } from "./views"

/**
 * Optional home page sections and fields a theme may draw (adr/0046 Ek
 * 2026-11-05), shared by every theme: one product up close, and the
 * shop's reviews in short. A storefront or backend before them leaves
 * them out and the theme draws what it drew before.
 */

/**
 * One product up close (`featured_product`): the shop chose it in the
 * home editor; the storefront adds its pictures, headline facts and spec
 * table, as its product page has them.
 */
export interface FeaturedProductSectionView {
  id: string
  type: "featured_product"
  /** The shop's heading; null: the theme's own words (or none). */
  title: string | null
  /** The shop's line about it, plain text; null: none. */
  text: string | null
  /** The product as a card has it: its page, the shopper's price, stock, quick add. */
  product: ProductCardView
  /** Its subtitle; null: none. */
  subtitle: string | null
  /** All its pictures in order, the card's first; none: no picture. */
  images: ImageView[]
  /** The facts the shop marked as headline ones (`SpecView.highlight`), in its order; none: no row. */
  facts: SpecView[]
  /** The spec table in its template's sections (`ProductPageView.specGroups`); none: no attributes. */
  specGroups: SpecGroupView[]
}

/**
 * The shop's approved reviews in short (`GET /store/reviews/summary`), on
 * the home page's reviews section and the reviews page: the card's stars
 * (`average` "4,6", `count`, `label` for a screen reader) and the spread.
 */
export interface ShopRatingView extends CardRatingView {
  /** How many gave each number of stars, 5 to 1 (the product page's shape). */
  distribution: RatingBarView[]
}
