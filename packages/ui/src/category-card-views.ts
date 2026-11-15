import type { CategoryCardStep } from "@qticaret/types"
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
