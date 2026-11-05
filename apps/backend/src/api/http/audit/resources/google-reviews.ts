import type { MedusaContainer } from "@medusajs/framework/types"
import { GOOGLE_REVIEWS_MODULE } from "../../../../modules/google-reviews"
import type GoogleReviewsModuleService from "../../../../modules/google-reviews/service"
import type { AuditedResource } from "../types"

/**
 * A Google review taken off the storefront or put back (adr/0058 Ek):
 * whether it is shown, the reason given, who and when, before and after.
 */
export const GOOGLE_REVIEW_RESOURCES: readonly AuditedResource[] = [
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
