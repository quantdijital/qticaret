import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { forgetGoogleReviewsWorkflow } from "../../../../workflows/google/reviews"
import { googleReviewsStatus } from "../../../../workflows/google/reviews-read"

/**
 * GET /admin/google/reviews (adr/0058): the shop's Google reviews as the
 * panel shows them: the connection and its Business Profile scope, the
 * location picked, Google's average and count, the last sync.
 */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  res.json({ google_reviews: await googleReviewsStatus(req.scope) })
}

/** DELETE /admin/google/reviews: no Google reviews on the storefront; the connection stays. */
export async function DELETE(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  const { result } = await forgetGoogleReviewsWorkflow(req.scope).run({ input: {} })
  res.json({ removed: result.removed })
}
