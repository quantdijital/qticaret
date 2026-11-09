import "server-only"
import { cache } from "react"
import type {
  StoreCardFacts,
  StoreCategoryImage,
  StoreCollectionDetails,
  StoreGoogleReviews,
  StoreLatestReviewPhoto,
  StoreReviewSummary,
} from "@qticaret/types"
import { isStoreApiError } from "./errors"
import { storeGet, storePublicGet } from "./server"

/**
 * The Store API calls behind the theme contract's optional fields
 * (adr/0046 Ek 2026-11-04): category pictures, card facts, customer
 * photos, a collection's intro and picture. A backend that does not answer one (an older one, a failure)
 * leaves the field out; the page is drawn as before.
 */

async function orNone<T>(load: () => Promise<T>, none: T): Promise<T> {
  try {
    return await load()
  } catch (error) {
    if (isStoreApiError(error)) {
      return none
    }
    throw error
  }
}

/** Every live category's picture, by category id: shop-wide, kept a minute. */
export const categoryImages = cache(async (): Promise<ReadonlyMap<string, StoreCategoryImage>> => {
  const { images } = await orNone(
    () => storePublicGet<{ images: StoreCategoryImage[] }>("/store/category-images"),
    { images: [] }
  )
  return new Map(images.map((image) => [image.category_id, image]))
})

/**
 * A shown collection's intro and picture (Ürünler > Koleksiyonlar); none
 * from a backend without them, or for a collection hidden since its page
 * was resolved.
 */
export const collectionDetails = cache(
  async (id: string): Promise<StoreCollectionDetails> =>
    (
      await orNone(
        () =>
          storeGet<{ details: StoreCollectionDetails }>(
            `/store/collections/${encodeURIComponent(id)}/details`
          ),
        { details: { description: null, image: null } }
      )
    ).details
)

// The card facts route takes a hundred products at a time
const FACTS_CHUNK = 100

/** A page of cards' stock buckets and quick-add variants, by product id; never cached (stock). */
export async function cardFacts(
  productIds: readonly string[]
): Promise<Record<string, StoreCardFacts>> {
  const unique = [...new Set(productIds)]
  const found: Record<string, StoreCardFacts> = {}
  for (let start = 0; start < unique.length; start += FACTS_CHUNK) {
    const { facts } = await orNone(
      () =>
        storeGet<{ facts: Record<string, StoreCardFacts> }>("/store/card-facts", {
          id: unique.slice(start, start + FACTS_CHUNK),
        }),
      { facts: {} }
    )
    Object.assign(found, facts)
  }
  return found
}

/** The shop's approved reviews in short (adr/0046 Ek 2026-11-05); null without one or an answer. */
export const reviewSummary = cache(
  async (): Promise<StoreReviewSummary["rating"]> =>
    (
      await orNone(() => storeGet<StoreReviewSummary>("/store/reviews/summary"), {
        rating: null,
      })
    ).rating
)

/**
 * The shop's Google reviews (adr/0058): Google's figures and the newest
 * reviews, shop-wide, kept a minute; none without an answer.
 */
export const googleReviews = cache(
  async (limit: number): Promise<StoreGoogleReviews["google_reviews"]> =>
    (
      await orNone(() => storePublicGet<StoreGoogleReviews>("/store/google-reviews", { limit }), {
        google_reviews: null,
      })
    ).google_reviews
)

/**
 * Google's figures and the newest `limit` reviews of at least
 * `minRating` stars with text, for the home page's rating badge (adr/0058
 * Ek 2026-11-06); `limit` 0, the figures alone.
 */
export const googleRatingReviews = cache(
  async (limit: number, minRating: number): Promise<StoreGoogleReviews["google_reviews"]> =>
    (
      await orNone(
        () =>
          storePublicGet<StoreGoogleReviews>("/store/google-reviews", {
            limit,
            min_rating: minRating,
          }),
        { google_reviews: null }
      )
    ).google_reviews
)

/** The newest photos on approved reviews, for the home page's reviews section. */
export const latestReviewPhotos = cache(
  async (limit: number): Promise<StoreLatestReviewPhoto[]> =>
    (
      await orNone(
        () => storeGet<{ photos: StoreLatestReviewPhoto[] }>("/store/reviews/photos", { limit }),
        { photos: [] }
      )
    ).photos
)
