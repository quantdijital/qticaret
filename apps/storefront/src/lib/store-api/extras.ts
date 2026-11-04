import "server-only"
import { cache } from "react"
import type { StoreCardFacts, StoreCategoryImage, StoreLatestReviewPhoto } from "@qticaret/types"
import { isStoreApiError } from "./errors"
import { storeGet, storePublicGet } from "./server"

/**
 * The Store API calls behind the theme contract's optional fields
 * (adr/0046 Ek 2026-11-04): category pictures, card facts, customer
 * photos. A backend that does not answer one (an older one, a failure)
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
