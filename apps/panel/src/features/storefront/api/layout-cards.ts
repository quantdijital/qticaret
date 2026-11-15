import type { CategoryCardStep, FooterBarStep, PaymentBadge } from "@qticaret/types"

// The linked category cards and the footer bar's own settings in the theme
// editor's document (adr/0049 Ek 2026-11-15)

/** The linked cards' own fields (`linked`): columns, the picture's place, the frame, the links. */
export interface CategoriesLinkedFields {
  variant: "linked"
  columns: CategoryCardStep<"columns">
  image_position: CategoryCardStep<"image_position">
  frame: CategoryCardStep<"frame">
  /** Subcategory links under each card's name (0–8). */
  links: number
}

/** The footer's settings, the same in every footer variant. */
export interface FooterBarFields {
  social: FooterBarStep<"social">
  /** In the shop's order, each once. */
  payment_badges: PaymentBadge[]
  back_to_top: boolean
  back_to_top_side: FooterBarStep<"back_to_top_side">
  back_to_top_shape: FooterBarStep<"back_to_top_shape">
  back_to_top_mobile: boolean
}
