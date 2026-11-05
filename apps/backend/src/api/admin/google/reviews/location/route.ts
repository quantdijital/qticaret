import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { chooseGoogleReviewLocationWorkflow } from "../../../../../workflows/google/reviews"
import { googleReviewsStatus } from "../../../../../workflows/google/reviews-read"
import { syncGoogleReviewsWorkflow } from "../../../../../workflows/google/reviews-sync"
import type { AdminPostGoogleReviewLocationType } from "../../validators"

/**
 * POST /admin/google/reviews/location: the location whose Google reviews
 * the storefront shows, checked with Google, then its reviews read at once.
 */
export async function POST(
  req: AuthenticatedMedusaRequest<AdminPostGoogleReviewLocationType>,
  res: MedusaResponse
): Promise<void> {
  await chooseGoogleReviewLocationWorkflow(req.scope).run({ input: req.validatedBody })
  const { result } = await syncGoogleReviewsWorkflow(req.scope).run({
    input: { trigger: "chosen" },
  })
  res.json({ google_reviews: await googleReviewsStatus(req.scope), sync: result })
}
