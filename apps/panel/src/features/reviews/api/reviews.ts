import { keepPreviousData, queryOptions } from "@tanstack/react-query"
import { sdk } from "@/lib/sdk"

export const REVIEW_STATUSES = ["pending", "approved", "rejected"] as const
export type ReviewStatus = (typeof REVIEW_STATUSES)[number]
export const REVIEW_PAGE_SIZE = 20

export interface ReviewRow {
  id: string
  rating: number
  title: string | null
  body: string
  author_name: string
  customer_id: string
  order_id: string
  status: ReviewStatus
  has_link: boolean
  reject_reason: string | null
  created_at: string
  /** The version shown: an approval applies to it only. */
  updated_at: string
  product: { id: string; title: string | null; thumbnail: string | null }
}

/** Reviews by state (F10.6): the waiting ones oldest first. */
export const reviewsQuery = (status: ReviewStatus, page: number) =>
  queryOptions({
    queryKey: ["reviews", status, page],
    queryFn: () =>
      sdk.client.fetch<{ reviews: ReviewRow[]; count: number }>("/admin/product-reviews", {
        query: { status, offset: page * REVIEW_PAGE_SIZE },
      }),
    placeholderData: keepPreviousData,
  })

/**
 * Approves or rejects reviews at once, as shown: one its author changed
 * since stays waiting and comes back in `changed`.
 */
export const moderateReviews = (body: {
  reviews: { id: string; updated_at: string }[]
  status: "approved" | "rejected"
  reason?: string
}) =>
  sdk.client.fetch<{ moderated: number; changed: string[] }>("/admin/product-reviews/moderate", {
    method: "POST",
    body,
  })
