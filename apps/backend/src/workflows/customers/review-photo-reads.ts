import type { MedusaContainer } from "@medusajs/framework/types"
import { PRODUCT_REVIEWS_MODULE } from "../../modules/product-reviews"
import type ProductReviewsModuleService from "../../modules/product-reviews/service"

type Container = Pick<MedusaContainer, "resolve">

/** A review's photo as the storefront shows it: its address and size. */
export interface ReviewPhotoView {
  id: string
  url: string
  width: number
  height: number
}

/** One of the newest customer photos, with its review's stars and author and its product. */
export interface LatestReviewPhoto extends ReviewPhotoView {
  review_id: string
  rating: number
  author_name: string
  created_at: Date
  product: { id: string; title: string }
}

const reviews = (container: Container) =>
  container.resolve<ProductReviewsModuleService>(PRODUCT_REVIEWS_MODULE)

/** The photos of these reviews, each review's in its order (adr/0037 §4 Ek 2026-11-04). */
export async function photosByReview(
  container: Container,
  reviewIds: readonly string[]
): Promise<Map<string, ReviewPhotoView[]>> {
  const found = new Map<string, ReviewPhotoView[]>()
  if (reviewIds.length === 0) {
    return found
  }
  const rows = await reviews(container).listReviewImages(
    { review_id: [...new Set(reviewIds)] },
    {
      select: ["id", "review_id", "url", "width", "height", "rank"],
      order: { rank: "ASC" },
      take: null,
    }
  )
  for (const row of rows) {
    if (!row.review_id) {
      continue
    }
    const list = found.get(row.review_id) ?? []
    list.push({ id: row.id, url: row.url, width: row.width, height: row.height })
    found.set(row.review_id, list)
  }
  return found
}

// Photos are read in pages this size until enough of them are on approved reviews
const SCAN = 100
const SCAN_PAGES = 5

/**
 * The newest photos on approved reviews of products the shopper may see
 * (`visible`: id → title), for the home page's customer photos (adr/0046
 * Ek 2026-11-04). A photo waiting on a review the shop has not approved,
 * or rejected, is never among them.
 */
export async function latestReviewPhotos(
  container: Container,
  visible: ReadonlyMap<string, string>,
  limit: number
): Promise<LatestReviewPhoto[]> {
  if (visible.size === 0) {
    return []
  }
  const service = reviews(container)
  const found: LatestReviewPhoto[] = []
  for (let page = 0; page < SCAN_PAGES && found.length < limit; page += 1) {
    const photos = await service.listReviewImages(
      { review_id: { $ne: null }, product_id: [...visible.keys()] },
      {
        select: ["id", "review_id", "product_id", "url", "width", "height", "created_at"],
        order: { created_at: "DESC", id: "DESC" },
        skip: page * SCAN,
        take: SCAN,
      }
    )
    const reviewIds = [...new Set(photos.flatMap((photo) => photo.review_id ?? []))]
    const approved = reviewIds.length
      ? await service.listProductReviews(
          { id: reviewIds, status: "approved" },
          { select: ["id", "rating", "author_name"] }
        )
      : []
    const byId = new Map(approved.map((review) => [review.id, review]))
    for (const photo of photos) {
      const review = byId.get(photo.review_id ?? "")
      if (review && found.length < limit) {
        found.push({
          id: photo.id,
          url: photo.url,
          width: photo.width,
          height: photo.height,
          review_id: review.id,
          rating: review.rating,
          author_name: review.author_name,
          created_at: photo.created_at,
          product: { id: photo.product_id, title: visible.get(photo.product_id) ?? "" },
        })
      }
    }
    if (photos.length < SCAN) {
      break
    }
  }
  return found
}
