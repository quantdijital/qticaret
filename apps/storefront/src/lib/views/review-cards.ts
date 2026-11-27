import "server-only"
import type { StoreReviewPhoto } from "@qticaret/types"
import type { ImageView, ReviewView, ReviewedProductView, Translate } from "@qticaret/ui"
import { pathsOf } from "@/lib/store-api/requests"
import { isStoreApiError } from "@/lib/store-api/errors"
import { storeGet } from "@/lib/store-api/server"
import { reviewPhotos } from "./card-extras"
import { productImages } from "./image"
import { productsInOrder } from "./section-data"

/**
 * The shop's newest reviews as the home page's section shows them
 * (adr/0049), and each reviewed product's first picture for a card that
 * asks for one (the reviews page's, adr/0046 Ek 2026-11-05; the carousel's
 * `product_image`, adr/0077 §10 Ek).
 */

const DATE = new Intl.DateTimeFormat("tr-TR", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "Europe/Istanbul",
})

interface ReviewsAnswer {
  reviews: {
    product_id: string
    product_title: string
    rating: number
    title: string | null
    body: string
    author_name: string | null
    created_at: string
    verified_purchase: boolean
    photos?: StoreReviewPhoto[]
  }[]
}

/** Each reviewed product's first picture: one call; without an answer, no pictures. */
export async function reviewedProductPictures(
  ids: readonly string[]
): Promise<Map<string, ImageView>> {
  try {
    const products = await productsInOrder(ids)
    return new Map(
      products.flatMap((product) => {
        const [first] = productImages(product)
        return first ? [[product.id, first] as const] : []
      })
    )
  } catch (error) {
    if (!isStoreApiError(error)) {
      throw error
    }
    return new Map()
  }
}

/**
 * The newest approved reviews, up to `limit`; with `pictures`, each one's
 * product carries its first picture (none: the card draws as without).
 */
export async function reviewViews(
  limit: number,
  t: Translate,
  pictures = false
): Promise<(ReviewView & { product: ReviewedProductView | null })[]> {
  let answer: ReviewsAnswer
  try {
    answer = await storeGet<ReviewsAnswer>("/store/reviews", { offset: 0, limit })
  } catch (error) {
    if (!isStoreApiError(error)) {
      throw error
    }
    return []
  }
  const ids = [...new Set(answer.reviews.map((review) => review.product_id))]
  const [paths, images] = await Promise.all([
    pathsOf("product", ids),
    pictures ? reviewedProductPictures(ids) : Promise.resolve(new Map<string, ImageView>()),
  ])
  return answer.reviews.map((review) => {
    const path = paths[review.product_id]
    const author = review.author_name ?? t("product.anonymous")
    const image = images.get(review.product_id)
    return {
      rating: review.rating,
      title: review.title,
      body: review.body,
      author,
      date: DATE.format(new Date(review.created_at)),
      verified: review.verified_purchase,
      photos: reviewPhotos(review.photos, author, t),
      product: path ? { label: review.product_title, path, ...(image ? { image } : {}) } : null,
    }
  })
}
