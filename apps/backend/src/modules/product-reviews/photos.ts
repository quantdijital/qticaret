import type { Context } from "@medusajs/framework/types"
import { ValidationError } from "../../lib/errors"

/** The most photos one review shows (adr/0037 §4 Ek 2026-11-04). */
export const REVIEW_PHOTOS_MAX = 3

/** A photo that left its review, for its file to be removed once the write is done. */
export interface RemovedPhoto {
  id: string
  file_id: string
}

interface PhotoRow {
  id: string
  review_id: string | null
  file_id: string
}

/** The service's photo methods this needs, in the write's transaction. */
export interface PhotoStore {
  listReviewImages(
    filters: Record<string, unknown>,
    config: { select: string[] },
    sharedContext?: Context
  ): Promise<PhotoRow[]>
  updateReviewImages(
    data: { id: string; review_id: string; rank: number }[],
    sharedContext?: Context
  ): Promise<unknown>
  deleteReviewImages(ids: string[], sharedContext?: Context): Promise<void>
}

/**
 * The review's photos made exactly `photoIds`, in that order: each must be
 * the author's own upload for this product, not on another review. Photos
 * the review had and the list leaves out go; their files are the caller's
 * to remove after the write. Run in the review's own transaction.
 */
export async function setReviewPhotos(
  store: PhotoStore,
  input: { review_id: string; product_id: string; customer_id: string; photo_ids: string[] },
  sharedContext: Context
): Promise<RemovedPhoto[]> {
  const wanted = [...new Set(input.photo_ids)]
  if (wanted.length > REVIEW_PHOTOS_MAX) {
    throw new ValidationError("reviews.photos_too_many", { field: "photo_ids" })
  }
  const [chosen, current] = await Promise.all([
    wanted.length
      ? store.listReviewImages(
          { id: wanted, customer_id: input.customer_id, product_id: input.product_id },
          { select: ["id", "review_id", "file_id"] },
          sharedContext
        )
      : Promise.resolve([]),
    store.listReviewImages(
      { review_id: input.review_id },
      { select: ["id", "review_id", "file_id"] },
      sharedContext
    ),
  ])
  const usable = chosen.filter(
    (photo) => photo.review_id === null || photo.review_id === input.review_id
  )
  if (usable.length !== wanted.length) {
    throw new ValidationError("reviews.photo_unknown", { field: "photo_ids" })
  }
  if (wanted.length > 0) {
    await store.updateReviewImages(
      wanted.map((id, rank) => ({ id, review_id: input.review_id, rank })),
      sharedContext
    )
  }
  const left = current.filter((photo) => !wanted.includes(photo.id))
  if (left.length > 0) {
    await store.deleteReviewImages(
      left.map((photo) => photo.id),
      sharedContext
    )
  }
  return left.map(({ id, file_id }) => ({ id, file_id }))
}
