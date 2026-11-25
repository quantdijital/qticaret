import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { cancelOrderAsStaff } from "../../../../../../../lib/ai-credits/grant"
import { answeringAiConflicts } from "../../../../../../http/ai-conflicts"
import { noteAuditChanges } from "../../../../../../http/audit"
import { actorOf, paramOf } from "../../../../tenants/params"
import { shopOf } from "../../../shops"
import type { PostAiOrderCancelType } from "../../../validators"
import { orderView } from "../../../views"

/**
 * POST /admin/cp/ai/orders/:id/cancel (owner, step-up; adr/0085 K11): a
 * pending request cancelled; a paid or cancelled one is
 * `cp.ai_credit_order_closed`. The audit row names the shop and keeps the
 * owner's optional note why (P3d; the request itself has no note column,
 * so the note lives in the audit row alone).
 */
export async function POST(
  req: AuthenticatedMedusaRequest<PostAiOrderCancelType>,
  res: MedusaResponse
): Promise<void> {
  const order = await answeringAiConflicts(res, () =>
    cancelOrderAsStaff(req.scope, {
      orderId: paramOf(req, "id"),
      actor: actorOf(req),
      now: new Date(),
    })
  )
  if (order === undefined) {
    return
  }
  const note = req.validatedBody.note ?? null
  noteAuditChanges(req, {
    order: {
      tenant_id: order.tenant_id,
      to: "cancelled",
      credits: order.credits,
      ...(note === null ? {} : { note }),
    },
  })
  res.json({ order: orderView(order, await shopOf(req, order.tenant_id)) })
}
