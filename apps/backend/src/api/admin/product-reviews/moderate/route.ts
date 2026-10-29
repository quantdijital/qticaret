import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { PRODUCT_REVIEWS_MODULE } from "../../../../modules/product-reviews"
import type ProductReviewsModuleService from "../../../../modules/product-reviews/service"
import { SEO_REDIRECTS_MODULE } from "../../../../modules/seo-redirects"
import type SeoRedirectsModuleService from "../../../../modules/seo-redirects/service"
import type { AdminPostModerateReviewsType } from "../validators"

/**
 * POST /admin/product-reviews/moderate (F10.6): the shop approves or
 * rejects reviews as it saw them; one its author changed since is left
 * waiting and named in `changed`. The stars of each product touched are
 * summed again, and the storefront's cached answers for its pages are
 * forgotten.
 */
export async function POST(
  req: AuthenticatedMedusaRequest<AdminPostModerateReviewsType>,
  res: MedusaResponse
): Promise<void> {
  const { reviews, status, reason } = req.validatedBody
  const result = await req.scope
    .resolve<ProductReviewsModuleService>(PRODUCT_REVIEWS_MODULE)
    .moderate({ reviews, status, by: req.auth_context.actor_id, reason: reason ?? null })
  // The product pages' stars change: their cached answers go now, not in 30 seconds
  await req.scope.resolve<SeoRedirectsModuleService>(SEO_REDIRECTS_MODULE).invalidateResolutions()
  res.json({
    moderated: reviews.length - result.changed.length,
    changed: result.changed,
    products: result.products,
  })
}
