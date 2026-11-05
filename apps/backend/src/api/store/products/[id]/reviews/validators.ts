import { z } from "@medusajs/framework/zod"
import { REVIEW_PHOTOS_MAX } from "../../../../../modules/product-reviews/photos"

// Text as typed, without control characters other than line breaks
const plain = (value: string): string => value.replace(/[^\P{Cc}\n]/gu, "").trim()

/**
 * A customer's review: stars, an optional title, and what they have to
 * say; `photo_ids` are their uploads for it, in order (adr/0037 §4 Ek
 * 2026-11-04). Left out, the review keeps the photos it has.
 */
export const StorePostReview = z
  .object({
    rating: z.number().int().min(1).max(5),
    title: z.string().transform(plain).pipe(z.string().max(100)).optional(),
    body: z.string().transform(plain).pipe(z.string().min(10).max(2000)),
    photo_ids: z
      .array(z.string().regex(/^rvph_[0-9A-Za-z]{1,64}$/))
      .max(REVIEW_PHOTOS_MAX)
      .optional(),
  })
  .strict()
export type StorePostReviewType = z.infer<typeof StorePostReview>

export const StoreGetReviews = z.object({
  offset: z.coerce.number().int().min(0).max(10_000).default(0),
  limit: z.coerce.number().int().min(1).max(50).default(10),
})
export type StoreGetReviewsType = z.infer<typeof StoreGetReviews>

/** The home page's customer photos: how many, newest first. */
export const StoreGetReviewPhotos = z
  .object({ limit: z.coerce.number().int().min(1).max(24).default(12) })
  .strict()
export type StoreGetReviewPhotosType = z.infer<typeof StoreGetReviewPhotos>

/** A photo's upload: its bytes are the body; nothing in the address. */
export const StorePostReviewPhotoQuery = z.object({}).strict()

/** The shop's reviews in short (adr/0046 Ek 2026-11-05): nothing to ask. */
export const StoreGetReviewSummary = z.object({}).strict()
