import type {
  CategoryCardStep,
  CategoryCollageStep,
  FooterBarStep,
  PaymentBadge,
} from "@qticaret/types"

// The linked category cards and the footer bar's own settings in the theme
// editor's document (adr/0049 Ek 2026-11-15)

/** The linked cards' own fields (`linked`): columns, the picture's place, the frame, the links. */
export interface CategoriesLinkedFields {
  variant: "linked"
  columns: CategoryCardStep<"columns">
  /** Cards in a row on a phone (bilesen-denetimi (b) 3); the server fills 1 on reading. */
  columns_mobile?: CategoryCardStep<"columns_mobile">
  image_position: CategoryCardStep<"image_position">
  frame: CategoryCardStep<"frame">
  /** Subcategory links under each card's name (0–8). */
  links: number
}

/** The collage's own fields (`collage`): cards in a row, the photo's height, the lead, the links. */
export interface CategoriesCollageFields {
  variant: "collage"
  columns: CategoryCollageStep<"columns">
  /** Cards in a row on a phone; the server fills 1 on reading. */
  columns_mobile?: CategoryCollageStep<"columns_mobile">
  height: CategoryCollageStep<"height">
  lead: CategoryCollageStep<"lead">
  /** Subcategory links under each card's name (0–8). */
  links: number
}

/** The footer's settings, the same in every footer variant. */
export interface FooterBarFields {
  /** The name or the store profile's logo over the contact (owner 2026-11-16). */
  brand: FooterBarStep<"brand">
  social: FooterBarStep<"social">
  /** In the shop's order, each once. */
  payment_badges: PaymentBadge[]
  back_to_top: boolean
  back_to_top_side: FooterBarStep<"back_to_top_side">
  back_to_top_shape: FooterBarStep<"back_to_top_shape">
  back_to_top_mobile: boolean
}
