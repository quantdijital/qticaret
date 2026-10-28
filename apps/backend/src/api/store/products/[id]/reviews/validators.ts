import { z } from "@medusajs/framework/zod"

// Text as typed, without control characters other than line breaks
const plain = (value: string): string => value.replace(/[^\P{Cc}\n]/gu, "").trim()

/** A customer's review: stars, an optional title, and what they have to say. */
export const StorePostReview = z
  .object({
    rating: z.number().int().min(1).max(5),
    title: z.string().transform(plain).pipe(z.string().max(100)).optional(),
    body: z.string().transform(plain).pipe(z.string().min(10).max(2000)),
  })
  .strict()
export type StorePostReviewType = z.infer<typeof StorePostReview>

export const StoreGetReviews = z.object({
  offset: z.coerce.number().int().min(0).max(10_000).default(0),
  limit: z.coerce.number().int().min(1).max(50).default(10),
})
export type StoreGetReviewsType = z.infer<typeof StoreGetReviews>
