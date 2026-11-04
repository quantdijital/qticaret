import type {
  CategoryCardView,
  CustomerPhotoView,
  ImageView,
  LinkView,
  ProductCardView,
  RatingBarView,
  ReviewPhotoView,
  ShopMarkView,
  Translate,
} from "@qticaret/ui"
import type {
  StoreCardFacts,
  StoreImage,
  StoreLatestReviewPhoto,
  StoreRatingDistribution,
  StoreReviewPhoto,
} from "@qticaret/types"
import { imageView } from "./image"

/**
 * The theme contract's optional fields (adr/0046 Ek 2026-11-04) from the
 * Store answers: pure, so both themes get the same words and numbers.
 */

/** A category's link with its picture, when it has one; the alt text falls back to its name. */
export function categoryCard(
  link: LinkView,
  image: StoreImage | null | undefined
): CategoryCardView {
  return image ? { ...link, image: imageView(image, link.label) } : link
}

/**
 * Cards with their stock bucket and quick add from the card facts. Quick
 * add goes only on a card that shows a price and can be bought now: the
 * facts are a moment younger than the card's own answer.
 */
export function withCardFacts(
  cards: readonly ProductCardView[],
  facts: Readonly<Record<string, StoreCardFacts>>
): ProductCardView[] {
  return cards.map((card) => {
    const fact = facts[card.id]
    if (!fact) {
      return card
    }
    const quick = fact.quick_add && card.price && card.available ? fact.quick_add : null
    return {
      ...card,
      stock: fact.stock,
      quickAdd: quick ? { variantId: quick.variant_id } : null,
    }
  })
}

const STARS = [5, 4, 3, 2, 1] as const

/** The stars' spread as bars, 5 to 1, each its share of all; none without a review. */
export function ratingBars(
  distribution: StoreRatingDistribution | null | undefined,
  t: Translate
): RatingBarView[] | null {
  if (!distribution) {
    return null
  }
  // A count the answer left out reads as none
  const countOf = (stars: (typeof STARS)[number]): number => {
    const count: unknown = distribution[String(stars) as keyof StoreRatingDistribution]
    return typeof count === "number" && Number.isFinite(count) ? count : 0
  }
  const total = STARS.reduce((sum, stars) => sum + countOf(stars), 0)
  if (total <= 0) {
    return null
  }
  return STARS.map((stars) => {
    const count = countOf(stars)
    return {
      stars,
      count,
      percent: Math.round((count / total) * 100),
      label: t("reviews.bar_label", { stars, count }),
    }
  })
}

/** A photo on a review, its size known: no box jumps while it loads. */
export const reviewPhotoImage = (photo: StoreReviewPhoto, alt: string): ImageView => ({
  src: photo.url,
  alt,
  width: photo.width,
  height: photo.height,
  sources: { avif: null, webp: null },
})

/** A review's photos in the author's order, each named for a screen reader. */
export const reviewPhotos = (
  photos: readonly StoreReviewPhoto[] | undefined,
  author: string,
  t: Translate
): ReviewPhotoView[] =>
  (photos ?? []).map((photo, index) => ({
    image: reviewPhotoImage(photo, t("reviews.photo_alt", { author, n: index + 1 })),
  }))

/** The newest customer photos, each at its product's page when the product has one. */
export function customerPhotos(
  photos: readonly StoreLatestReviewPhoto[],
  paths: Readonly<Record<string, string>>,
  t: Translate
): CustomerPhotoView[] {
  return photos.map((photo) => {
    const path = paths[photo.product.id]
    return {
      image: reviewPhotoImage(
        photo,
        t("reviews.customer_photo_alt", { product: photo.product.title })
      ),
      product: path ? { label: photo.product.title, path } : null,
      rating: photo.rating,
      author: photo.author_name,
    }
  })
}

/** The footer's ways to pay or carriers, by key, in the storefront's words. */
export const shopMarks = (keys: readonly string[] | undefined, t: Translate): ShopMarkView[] =>
  (keys ?? []).map((key) => ({ key, label: t(`marks.${key}`) }))
