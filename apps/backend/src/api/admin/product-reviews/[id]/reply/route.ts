import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { replyToReviewWorkflow } from "../../../../../workflows/customers/review-reply"
import type { AdminPostReviewReplyType } from "../../validators"

/**
 * POST /admin/product-reviews/:id/reply: the shop's public reply under an
 * approved review, written or replaced. Audited as `product_review`.
 */
export async function POST(
  req: AuthenticatedMedusaRequest<AdminPostReviewReplyType>,
  res: MedusaResponse
): Promise<void> {
  const { result } = await replyToReviewWorkflow(req.scope).run({
    input: {
      id: req.params["id"] ?? "",
      reply: req.validatedBody.body,
      user_id: req.auth_context.actor_id,
    },
  })
  res.json({ reply: result })
}

/** DELETE /admin/product-reviews/:id/reply: the shop's reply removed. */
export async function DELETE(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  const { result } = await replyToReviewWorkflow(req.scope).run({
    input: { id: req.params["id"] ?? "", reply: null, user_id: req.auth_context.actor_id },
  })
  res.json({ reply: result })
}
