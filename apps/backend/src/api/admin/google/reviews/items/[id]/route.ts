import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ValidationError } from "../../../../../../lib/errors"
import { setGoogleReviewHiddenWorkflow } from "../../../../../../workflows/google/reviews"
import { isHideReason } from "../../../validators"
import type { AdminPostGoogleReviewType } from "../../../validators"

/**
 * POST /admin/google/reviews/items/:id (adr/0058 Ek): one Google review
 * taken off the storefront for one of the three reasons, or put back.
 * Google keeps it, and its average and count. Audited as `google_review`.
 */
export async function POST(
  req: AuthenticatedMedusaRequest<AdminPostGoogleReviewType>,
  res: MedusaResponse
): Promise<void> {
  const { hidden, reason } = req.validatedBody
  const id = req.params["id"] ?? ""
  const userId = req.auth_context.actor_id
  if (hidden && (reason === undefined || !isHideReason(reason))) {
    // The schema refuses it already; the type does not know
    throw new ValidationError("google.hide_reason_required", { field: "reason" })
  }
  const { result } = await setGoogleReviewHiddenWorkflow(req.scope).run({
    input:
      hidden && reason !== undefined && isHideReason(reason)
        ? { id, hidden: true, reason, user_id: userId }
        : { id, hidden: false, user_id: userId },
  })
  res.json({ review: result })
}
