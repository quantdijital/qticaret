import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { replyGoogleReviewWorkflow } from "../../../../../../../workflows/google/reviews-reply"
import type { AdminPostGoogleReviewReplyType } from "../../../../validators"

/**
 * POST /admin/google/reviews/items/:id/reply (adr/0058 Ek 2026-11-06): the
 * shop's reply to one Google review, written at Google (created or
 * replaced) and kept as Google answered it. Audited as `google_review`.
 */
export async function POST(
  req: AuthenticatedMedusaRequest<AdminPostGoogleReviewReplyType>,
  res: MedusaResponse
): Promise<void> {
  const { result } = await replyGoogleReviewWorkflow(req.scope).run({
    input: {
      id: req.params["id"] ?? "",
      comment: req.validatedBody.comment,
      user_id: req.auth_context.actor_id,
    },
  })
  res.json({ reply: result })
}

/** DELETE /admin/google/reviews/items/:id/reply: the shop's reply removed at Google and here. */
export async function DELETE(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  const { result } = await replyGoogleReviewWorkflow(req.scope).run({
    input: { id: req.params["id"] ?? "", comment: null, user_id: req.auth_context.actor_id },
  })
  res.json({ reply: result })
}
