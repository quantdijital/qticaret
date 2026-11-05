import type { MedusaResponse, MedusaStoreRequest } from "@medusajs/framework/http"
import { storefrontGoogleReviews } from "../../../workflows/google/reviews-read"
import type { StoreGetGoogleReviewsType } from "../../admin/google/validators"

/**
 * GET /store/google-reviews?limit= (adr/0058): the shop's Google reviews
 * for the storefront: Google's own average and count, the Maps link and
 * the newest reviews the shop did not hide. `google_reviews` is null while
 * there is nothing to show. Never in structured data (Google's review
 * snippet guidelines): the storefront draws it as text only.
 */
export async function GET(
  req: MedusaStoreRequest<unknown, StoreGetGoogleReviewsType>,
  res: MedusaResponse
): Promise<void> {
  const reviews = await storefrontGoogleReviews(req.scope, req.validatedQuery.limit)
  res.setHeader("Cache-Control", "public, max-age=300")
  res.json({ google_reviews: reviews })
}
