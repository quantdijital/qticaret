import "server-only"
import { cache } from "react"
import type {
  StoreCardFacts,
  StoreCategoryCounts,
  StoreCategoryDescription,
  StoreCategoryImage,
  StoreCollectionDetails,
  StoreGoogleReviews,
  StoreLatestReviewPhoto,
  StoreReviewSummary,
} from "@qticaret/types"
import { isStoreApiError } from "./errors"
import { liraRegion } from "./requests"
import { storeGet, storePublicFind, storePublicGet } from "./server"

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
 * Every shown category's product count, its shown subcategories' included
 * (adr/0049 Ek 2026-11-14 §10 karar 7b): counted by the backend in one
 * statement, shop-wide, kept a minute. None from a backend without it.
 */
export const categoryCounts = cache(async (): Promise<ReadonlyMap<string, number>> => {
  const { counts } = await orNone(
    () => storePublicGet<StoreCategoryCounts>("/store/category-counts"),
    { counts: {} }
  )
  return new Map(Object.entries(counts))
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
        { details: { description: null, description_html: null, image: null } }
      )
    ).details
)

/**
 * A live category's text as the shop formatted it (adr/0075 §4), the
 * backend's HTML of its document, for the foot of its first page: shop-wide,
 * kept a minute as the backend's answer is. Null for a category without
 * one (its plain text shows), a hidden one (404), a backend before it, or a
 * failed call: the page never fails for its text.
 */
export const categoryDescription = cache(async (id: string): Promise<string | null> => {
  try {
    const answer = await storePublicFind<StoreCategoryDescription>(
      `/store/category-descriptions/${encodeURIComponent(id)}`
    )
    return answer?.description_html ?? null
  } catch {
    return null
  }
})

// The card facts route takes a hundred products at a time
const FACTS_CHUNK = 100

/**
 * A page of cards' stock buckets and quick-add variants, by product id;
 * never cached (stock). A dated product's from price is asked in the
 * lira region (adr/0076 §10); without it, the backend's lira.
 */
export async function cardFacts(
  productIds: readonly string[]
): Promise<Record<string, StoreCardFacts>> {
  const unique = [...new Set(productIds)]
  const found: Record<string, StoreCardFacts> = {}
  if (unique.length === 0) {
    return found
  }
  const region = await liraRegion().catch(() => null)
  for (let start = 0; start < unique.length; start += FACTS_CHUNK) {
    const { facts } = await orNone(
      () =>
        storeGet<{ facts: Record<string, StoreCardFacts> }>("/store/card-facts", {
          id: unique.slice(start, start + FACTS_CHUNK),
          ...(region ? { region_id: region.id } : {}),
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
