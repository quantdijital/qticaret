import type { MedusaContainer } from "@medusajs/framework/types"
import { PRODUCT_REVIEWS_MODULE } from "../../../../modules/product-reviews"
import type ProductReviewsModuleService from "../../../../modules/product-reviews/service"
import type { AuditedResource } from "../types"

/**
 * The shop's reply under a product review, written or removed: whether
 * there is one, how long, who wrote it and when, before and after. Not
 * its words: they are on the storefront.
 */
const replySnapshot = async ({
  scope,
  params,
}: {
  scope: unknown
  params: Record<string, string>
}) => {
  const [review] = await (scope as MedusaContainer)
    .resolve<ProductReviewsModuleService>(PRODUCT_REVIEWS_MODULE)
    .listProductReviews(
      { id: params["id"] ?? "" },
      { take: 1, select: ["reply", "replied_by", "replied_at"] }
    )
  return review
    ? {
        replied: review.reply !== null,
        reply_length: review.reply?.length ?? 0,
        replied_by: review.replied_by,
        replied_at: review.replied_at ? new Date(review.replied_at).toISOString() : null,
      }
    : {}
}

export const PRODUCT_REVIEW_RESOURCES: readonly AuditedResource[] = (
  ["POST", "DELETE"] as const
).map((method): AuditedResource => ({
  method,
  route: `${method} /admin/product-reviews/:id/reply`,
  pattern: /^\/admin\/product-reviews\/(?<id>prev_[A-Za-z0-9]+)\/reply$/i,
  resourceType: "product_review",
  resourceId: (params) => params["id"] ?? null,
  snapshot: replySnapshot,
}))
