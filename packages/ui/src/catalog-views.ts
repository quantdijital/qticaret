import type { SliderSettings } from "@qticaret/types"
import type { CategoryCardView } from "./card-views"
import type { ImageView, LinkView } from "./views"

/**
 * The catalogue home page's parts as a theme draws them (adr/0049 Ek
 * 2026-11-14 §3.2 H17, and the note "Katalog ana sayfası"): the opening's
 * category list and the price bands strip. Every word already in words,
 * every link a path, every price formatted on the server from live prices.
 */

/** A product shown small: its picture, its name (or the shop's short label) and its page. */
export interface ProductThumbView {
  label: string
  path: string
  image: ImageView | null
}

/**
 * H17's own parts beside the opening's words, buttons and picture: the
 * category list (each row its picture and, when the shop shows them, its
 * product count), the link to every category, up to two category tiles,
 * up to four quick links (a category's with its small picture), the
 * products shown small under the button and the lowest of their prices.
 */
export interface HeroCatalogView {
  list: CategoryCardView[]
  all: LinkView
  tiles: CategoryCardView[]
  chips: CategoryCardView[]
  picks: ProductThumbView[]
  /** "4.249,00 TL": the lowest live price among the picks; null: not shown. */
  from: string | null
  /**
   * The opening's slides when the shop saved them (adr/0049 Ek 2026-11-15),
   * each with something to show; absent: one slide, the opening's own
   * heading, line, buttons and picture, drawn as before slides.
   */
  slides?: HeroCatalogSlideView[]
  /** How two or more slides turn: the slider's settings and the seconds a slide stays. */
  slider?: { settings: SliderSettings; interval: number }
}

/**
 * One slide of the opening: its heading (null: none), line, buttons, its
 * picture (null: the first slide's the shop's newest pictured product,
 * another's none) and where the picture leads. Without heading, line and
 * buttons the slide is its picture alone.
 */
export interface HeroCatalogSlideView {
  heading: string | null
  intro: string | null
  actions: LinkView[]
  image: ImageView | null
  link: LinkView | null
  /** Each button's place among the slide's links when a broken one was left out; absent: its drawn place. */
  actionsAt?: number[]
  /**
   * Its place among the section's slides in the design (a slide with
   * nothing to show is left out of the drawing), for the editor's field
   * mark; absent: its place in the drawing.
   */
  at?: number
}

/**
 * The price bands: each band its label, line, its category's name when it
 * has one, its category's listing (else the catalogue's) filtered by its
 * range and the products picked in it on the server.
 */
export interface PriceBandsSectionView {
  id: string
  type: "price_bands"
  title: string
  bands: {
    label: string
    text: string | null
    /** The band's category's name; absent: a price band over the whole shop. */
    category?: string
    path: string
    products: ProductThumbView[]
  }[]
}
