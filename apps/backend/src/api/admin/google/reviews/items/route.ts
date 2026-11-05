import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { panelGoogleReviews } from "../../../../../workflows/google/reviews-read"
import type { AdminGetGoogleReviewsType } from "../../validators"

/** GET /admin/google/reviews/items: the Google reviews kept, newest first, each hidden or shown. */
export async function GET(
  req: AuthenticatedMedusaRequest<unknown, AdminGetGoogleReviewsType>,
  res: MedusaResponse
): Promise<void> {
  res.json(await panelGoogleReviews(req.scope, req.validatedQuery.offset))
}
