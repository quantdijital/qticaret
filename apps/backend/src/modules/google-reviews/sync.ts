import type { GoogleReviewInput } from "../../lib/google/business-review"
import type { ReviewRow, SyncInput } from "./types"

// What the service reads of a review kept, and how one sync compares it with Google's

export const REVIEW_FIELDS = [
  "id",
  "review_id",
  "reviewer_name",
  "reviewer_photo_url",
  "rating",
  "comment",
  "written_at",
  "edited_at",
  "reply",
  "replied_at",
  "reply_state",
  "maps_review_id",
  "hidden",
  "hidden_reason",
  "hidden_by",
  "hidden_at",
] as const

const time = (value: Date | string | null): number | null =>
  value === null ? null : new Date(value).getTime()

/** Whether Google's review differs from the one kept, the shop's `hidden` aside. */
const changed = (kept: ReviewRow, now: GoogleReviewInput): boolean =>
  kept.reviewer_name !== now.reviewer_name ||
  kept.reviewer_photo_url !== now.reviewer_photo_url ||
  kept.rating !== now.rating ||
  kept.comment !== now.comment ||
  kept.reply !== now.reply ||
  kept.reply_state !== now.reply_state ||
  kept.maps_review_id !== now.maps_review_id ||
  time(kept.written_at) !== time(now.written_at) ||
  time(kept.edited_at) !== time(now.edited_at) ||
  time(kept.replied_at) !== time(now.replied_at)

/**
 * What one sync writes: Google's new reviews, the changed ones with the id
 * kept, and, when every page was read, the ids of those Google no longer has.
 */
export function diffReviews(
  kept: ReadonlyMap<string, ReviewRow>,
  input: Pick<SyncInput, "reviews" | "complete">
): {
  added: GoogleReviewInput[]
  updated: (GoogleReviewInput & { id: string })[]
  gone: string[]
} {
  const seen = new Set<string>()
  const added: GoogleReviewInput[] = []
  const updated: (GoogleReviewInput & { id: string })[] = []
  for (const review of input.reviews) {
    if (seen.has(review.review_id)) {
      continue
    }
    seen.add(review.review_id)
    const row = kept.get(review.review_id)
    if (!row) {
      added.push(review)
    } else if (changed(row, review)) {
      updated.push({ ...review, id: row.id })
    }
  }
  const gone = input.complete
    ? [...kept.values()].filter((row) => !seen.has(row.review_id)).map((row) => row.id)
    : []
  return { added, updated, gone }
}
