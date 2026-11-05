import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { googleReviewsStatus } from "../../../../../workflows/google/reviews-read"
import { syncGoogleReviewsWorkflow } from "../../../../../workflows/google/reviews-sync"

/** POST /admin/google/reviews/sync: the location's Google reviews read now, from the panel. */
export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  const { result } = await syncGoogleReviewsWorkflow(req.scope).run({
    input: { trigger: "panel" },
  })
  res.json({ google_reviews: await googleReviewsStatus(req.scope), sync: result })
}
