import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { setGoogleReviewHiddenWorkflow } from "../../../../../../workflows/google/reviews"
import type { AdminPostGoogleReviewType } from "../../../validators"

/**
 * POST /admin/google/reviews/items/:id: a Google review taken off the
 * storefront, or put back. Google keeps it, and its average and count.
 */
export async function POST(
  req: AuthenticatedMedusaRequest<AdminPostGoogleReviewType>,
  res: MedusaResponse
): Promise<void> {
  const { result } = await setGoogleReviewHiddenWorkflow(req.scope).run({
    input: { id: req.params["id"] ?? "", hidden: req.validatedBody.hidden },
  })
  res.json({ review: result })
}
