/**
 * The reviews carousel's picture of the product each review is about
 * (adr/0077 §10 Ek): `none` (today's card: the customer's photo when
 * there is one, the product's name as a link), `thumb` (a small square
 * picture of the product beside its name at the card's foot) or `cover`
 * (a short picture across the card's top: the customer's photo, else the
 * product's, its name on it). A product with no picture draws as `none`.
 *
 * Mirrors the backend's `sections/reviews.ts`; a unit test keeps them equal.
 */

export const REVIEWS_PRODUCT_IMAGES = ["none", "thumb", "cover"] as const
export type ReviewsProductImage = (typeof REVIEWS_PRODUCT_IMAGES)[number]

/** Absent (a carousel saved before it) or unknown (a newer backend's): `none`, today's card. */
export const REVIEWS_PRODUCT_IMAGE_DEFAULT: ReviewsProductImage = "none"

/** The step as the contract knows it, read forgivingly. */
export function reviewsProductImageOf(value: unknown): ReviewsProductImage {
  return REVIEWS_PRODUCT_IMAGES.find((step) => step === value) ?? REVIEWS_PRODUCT_IMAGE_DEFAULT
}
