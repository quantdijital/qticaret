import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { decideReviewWorkflow } from "../../../../../../workflows/fraud/decide"
import type { AdminPostFraudDecisionType } from "../../../validators"

/**
 * POST /admin/fraud/reviews/:id/decision (adr/0044 §3): approve the held
 * order (it may ship) or turn it down (it stays held; cancel it with its
 * refund from the order). 409 when someone decided it meanwhile.
 */
export async function POST(
  req: AuthenticatedMedusaRequest<AdminPostFraudDecisionType>,
  res: MedusaResponse
): Promise<void> {
  const { result } = await decideReviewWorkflow(req.scope).run({
    input: {
      id: req.params["id"] ?? "",
      status: req.validatedBody.status,
      by: req.auth_context.actor_id,
      note: req.validatedBody.note ?? null,
    },
  })
  res.json({ order_id: result.order_id, status: req.validatedBody.status })
}
