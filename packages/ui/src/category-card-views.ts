import type { CategoryCardStep, CategoryCollageStep } from "@qticaret/types"
import type { CategoryCardView } from "./card-views"
import type { LinkView } from "./views"

/**
 * The category cards' `linked` variant as a theme draws it (adr/0049 Ek
 * 2026-11-15): each category a card with its picture, name, count (when
 * the shop shows counts), its first subcategories as links and a "see
 * all" link to its own page. Only subcategories with a live path and
 * products are given; a theme draws what it is handed.
 */
export interface LinkedCategoryCardView extends CategoryCardView {
  /** The first subcategories, as many as the shop chose (0–8); none: just the card. */
  children: LinkView[]
  /** The category's own page, "Tümünü gör"; null when no subcategory is shown. */
  all: LinkView | null
}

export interface CategoryCardsView {
  /** Cards in a row on a wide screen; a tablet shows two. */
  columns: CategoryCardStep<"columns">
  /** Cards in a row on a phone (bilesen-denetimi (b) 3); absent: one, as before. */
  phoneColumns?: CategoryCardStep<"columns_mobile">
  /** Where the picture stands; `none` (or a card without one): the words alone. */
  imagePosition: CategoryCardStep<"image_position">
  /** A hairline frame round each card, or plain on the page. */
  frame: CategoryCardStep<"frame">
  cards: LinkedCategoryCardView[]
}

/**
 * The category cards' `collage` variant as a theme draws it (adr/0049 Ek
 * 2026-11-15): photo-led cards filling each row, the first twice as wide
 * and its row taller while `lead` is on. The cards are the linked ones
 * (their `all` unused: the whole card is the category's link).
 */
export interface CategoryCollageView {
  /** Cards in a row on a wide screen at most, the lead counting two; a tablet takes two. */
  columns: CategoryCollageStep<"columns">
  /** Two in a row on a phone when the shop asks; absent: one. */
  phoneColumns?: 2
  /** The photo's height step; the lead's row a step taller. */
  height: CategoryCollageStep<"height">
  /** The first card twice as wide (and its row taller). */
  lead: boolean
  cards: LinkedCategoryCardView[]
}

/**
 * The category cards' `panels` variant as a theme draws it (adr/0049 Ek
 * 2026-11-19): the collage's settings, read as frameless graphite panels
 * (the first tall beside the others stacked while `lead` is on; `columns`
 * lays out the rows while it is off). The cards are the linked ones.
 */
export type CategoryPanelsView = CategoryCollageView
