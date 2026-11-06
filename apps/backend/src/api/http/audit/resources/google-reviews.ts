import type { MedusaContainer } from "@medusajs/framework/types"
import { GOOGLE_REVIEWS_MODULE } from "../../../../modules/google-reviews"
import type GoogleReviewsModuleService from "../../../../modules/google-reviews/service"
import type { AuditedResource } from "../types"

const reviewsOf = (scope: unknown) =>
  (scope as MedusaContainer).resolve<GoogleReviewsModuleService>(GOOGLE_REVIEWS_MODULE)

/**
 * The shop's reply to a Google review, written or removed (adr/0058 Ek
 * 2026-11-06): whether there is one, how long, Google's time and
 * moderation, before and after. Not its words: they are on Google.
 */
const replySnapshot = async ({
  scope,
  params,
}: {
  scope: unknown
  params: Record<string, string>
}) => {
  const [review] = await reviewsOf(scope).listGoogleReviews(
    { id: params["id"] ?? "" },
    { take: 1, select: ["reply", "replied_at", "reply_state"] }
  )
  return review
    ? {
        replied: review.reply !== null,
        reply_length: review.reply?.length ?? 0,
        replied_at: review.replied_at ? new Date(review.replied_at).toISOString() : null,
        reply_state: review.reply_state,
      }
    : {}
}

const REPLY_PATTERN = /^\/admin\/google\/reviews\/items\/(?<id>grev_[A-Za-z0-9]+)\/reply$/i

/**
 * A Google review taken off the storefront or put back (adr/0058 Ek):
 * whether it is shown, the reason given, who and when, before and after.
 * And the shop's reply to it, written or removed.
 */
export const GOOGLE_REVIEW_RESOURCES: readonly AuditedResource[] = [
  ...(["POST", "DELETE"] as const).map((method): AuditedResource => ({
    method,
    route: `${method} /admin/google/reviews/items/:id/reply`,
    pattern: REPLY_PATTERN,
    resourceType: "google_review",
    resourceId: (params) => params["id"] ?? null,
    snapshot: replySnapshot,
  })),
  {
    method: "POST",
    route: "POST /admin/google/reviews/items/:id",
    pattern: /^\/admin\/google\/reviews\/items\/(?<id>grev_[A-Za-z0-9]+)$/i,
    resourceType: "google_review",
    resourceId: (params) => params["id"] ?? null,
    snapshot: async ({ scope, params }) => {
      const [review] = await (scope as unknown as MedusaContainer)
        .resolve<GoogleReviewsModuleService>(GOOGLE_REVIEWS_MODULE)
        .listGoogleReviews(
          { id: params["id"] ?? "" },
          { take: 1, select: ["hidden", "hidden_reason", "hidden_by", "hidden_at"] }
        )
      return review
        ? {
            hidden: review.hidden,
            hidden_reason: review.hidden_reason,
            hidden_by: review.hidden_by,
            hidden_at: review.hidden_at ? new Date(review.hidden_at).toISOString() : null,
          }
        : {}
    },
  },
]
