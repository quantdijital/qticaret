import type { FeaturedProductSettings, SliderSettings } from "@qticaret/types"
import type { RatingBarView, SpecGroupView } from "./card-views"
import type { CardRatingView, ImageView, LinkView, ProductCardView, SpecView } from "./views"

/**
 * Optional home page sections and fields a theme may draw (adr/0046 Ek
 * 2026-11-05), shared by every theme: one product up close, and the
 * shop's reviews in short. A storefront or backend before them leaves
 * them out and the theme draws what it drew before.
 */

/**
 * The home page's Google rating badge (`google_rating`, adr/0058 Ek
 * 2026-11-06): Google's own average (one decimal) and count from the
 * shop's Business Profile, a link to `/yorumlar`, if the shop wants a link
 * to its place on Google Maps, and up to three recent 4–5 star excerpts.
 * The storefront leaves the section out when there is nothing to show.
 * Text only: never structured data (Google's review snippet guidelines).
 */
export interface GoogleRatingSectionView {
  id: string
  type: "google_rating"
  title: string
  /** Google's average in Turkish (`4,6`), or null while Google has none. */
  average: string | null
  /** The same as a number, for the stars. */
  rating: number | null
  /** The whole badge in words for a screen reader. */
  label: string
  /** "Google'da 16 değerlendirme", the link to `/yorumlar`. */
  reviews: LinkView
  /** "Google'da gör": the place on Google Maps (https, a new tab); null when off or unknown. */
  profileUrl: string | null
  excerpts: GoogleRatingExcerptView[]
}

export interface GoogleRatingExcerptView {
  author: string
  rating: number
  ratingLabel: string
  /** The review's text, whole and on one line; a theme quotes its first sentence. */
  text: string
  date: { label: string; dateTime: string }
}

/**
 * The home page's sliding opening (`hero_slider`, adr/0049 Ek 2026-11-06),
 * an extra to the still hero: 2–6 slides in the shop's order. Nothing
 * moves by itself unless its `autoplay` is on; the theme stops it on hover, focus,
 * a visitor's own step and reduced motion. A theme without a slider draws
 * the first slide as its opening.
 */
export interface HeroSliderSectionView {
  id: string
  type: "hero_slider"
  slides: HeroSlideView[]
  /** `compact` a lower stage, `regular` the opening's own. */
  height: "compact" | "regular"
  /** The scroller kit's settings a slider has use for (bilesen-denetimi (b) 4). */
  settings: SliderSettings
  /** Seconds a slide stays while it plays (`sliderSecondsOf`). */
  interval: number
}

export interface HeroSlideView {
  image: ImageView
  /** A phone's own picture (under 640 px); null: the wide one. */
  mobileImage: ImageView | null
  heading: string | null
  text: string | null
  /** The slide's one action; null: none. */
  link: LinkView | null
  position: "left" | "center" | "right"
  /** `light`: light words on a dark picture; `dark`: dark words on a light one. */
  tone: "light" | "dark"
}

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
  /**
   * How its photographs stand (adr/0049 Ek 2026-11-15). Absent (an older
   * storefront): the collage, as before the setting.
   */
  settings?: FeaturedProductSettings
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
