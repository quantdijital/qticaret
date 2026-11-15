import type { HeroListSource, SliderSettings } from "@qticaret/types"
import type { LinkInput } from "@/features/storefront/api/menus"

// The catalogue home page's parts in the theme editor's document (adr/0049
// Ek 2026-11-14 §3.2 H17, and the note "Katalog ana sayfası")

interface Image {
  url: string
  alt: string | null
}

/** A category tile beside the opening: the category and the shop's picture for it (none: the category's). */
export interface HeroTile {
  category_id: string
  image: Image | null
}

/** A product shown small under the opening's button, with the shop's short label (none: its title). */
export interface HeroPick {
  product_id: string
  label: string | null
}

/**
 * One slide of H17's opening (adr/0049 Ek 2026-11-15): its heading (none:
 * none), line, up to two buttons, picture (none: the first slide's the
 * shop's newest product photo) and where the picture leads. Without words
 * it is the picture alone.
 */
export interface HeroCatalogSlide {
  image: Image | null
  heading: string | null
  text: string | null
  links: LinkInput[]
  link: LinkInput | null
}

/**
 * H17's own fields (`category_list`): the category list, the tiles beside
 * the opening, quick links under it, products shown small and "from", and
 * the opening's slides with how they turn.
 */
export interface HeroCatalogFields {
  variant: "category_list"
  list: HeroListSource
  /** Rows the list shows at most (4–12). */
  list_limit: number
  show_count: boolean
  tiles: HeroTile[]
  chips: LinkInput[]
  picks: HeroPick[]
  show_price: boolean
  /**
   * The opening's slides; absent until the shop edits them (an opening saved
   * before them is one slide of its own fields). The editor keeps the common
   * heading, line, buttons and picture the first slide's.
   */
  slides?: HeroCatalogSlide[]
  /** How two or more turn: the slider's settings, with its own defaults (turning by itself). */
  scroller?: SliderSettings
}

/**
 * One price band: its label, a line, its category and its upper bound in
 * whole lira. Without a category a price band (none: "and up", the last
 * price band only); with one the category's products up to it (none: the
 * whole category, no price; adr/0049, 2026-11-15).
 */
export interface PriceBand {
  label: string
  text: string | null
  max: number | null
  /** Absent from a design read before band categories: none. */
  category_id?: string | null
}
