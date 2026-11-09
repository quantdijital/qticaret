import { keepPreviousData, queryOptions, useMutation, useQueryClient } from "@tanstack/react-query"
import { sdk } from "@/lib/sdk"

export const REVIEW_STATUSES = ["pending", "approved", "rejected"] as const
export type ReviewStatus = (typeof REVIEW_STATUSES)[number]
/** The list's tabs: a state, or the approved ones the shop has not replied to yet. */
export const REVIEW_TABS = ["pending", "approved", "unreplied", "rejected"] as const
export type ReviewTab = (typeof REVIEW_TABS)[number]
export const REVIEW_PAGE_SIZE = 20
/** The longest reply the shop writes under a review (the API's limit). */
export const REVIEW_REPLY_MAX = 1000

export interface ReviewRow {
  id: string
  rating: number
  title: string | null
  body: string
  author_name: string
  /** None for one migrated whose author did not move (F14). */
  customer_id: string | null
  order_id: string | null
  origin: "storefront" | "migration"
  status: ReviewStatus
  has_link: boolean
  reject_reason: string | null
  /** The shop's public reply under it; null for none. */
  reply: string | null
  replied_at: string | null
  created_at: string
  /** The version shown: an approval applies to it only. */
  updated_at: string
  product: { id: string; title: string | null; thumbnail: string | null }
  /** The customer's photos, cleaned by the server; decided on with the review. */
  photos: ReviewPhoto[]
}

export interface ReviewPhoto {
  id: string
  url: string
  width: number
  height: number
}

/**
 * Reviews by state (F10.6): the waiting ones oldest first; "unreplied",
 * the approved ones the shop has not replied to yet.
 */
export const reviewsQuery = (tab: ReviewTab, page: number) =>
  queryOptions({
    queryKey: ["reviews", tab, page],
    queryFn: () =>
      sdk.client.fetch<{ reviews: ReviewRow[]; count: number }>("/admin/product-reviews", {
        query:
          tab === "unreplied"
            ? { status: "approved", replied: "false", offset: page * REVIEW_PAGE_SIZE }
            : { status: tab, offset: page * REVIEW_PAGE_SIZE },
      }),
    placeholderData: keepPreviousData,
  })

/** The shop's reply under an approved review, written or replaced, or removed (`body: null`). */
export function useReviewReply() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (input: { id: string; body: string | null }) => {
      const path = `/admin/product-reviews/${encodeURIComponent(input.id)}/reply`
      return input.body === null
        ? sdk.client.fetch(path, { method: "DELETE" })
        : sdk.client.fetch(path, { method: "POST", body: { body: input.body } })
    },
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ["reviews"] })
    },
  })
}

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
