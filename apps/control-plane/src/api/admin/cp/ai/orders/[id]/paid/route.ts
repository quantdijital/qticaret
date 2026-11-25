import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { markOrderPaid } from "../../../../../../../lib/ai-credits/grant"
import { answeringAiConflicts } from "../../../../../../http/ai-conflicts"
import { noteAuditChanges } from "../../../../../../http/audit"
import { actorOf, paramOf } from "../../../../tenants/params"
import type { PostAiOrderPaidType } from "../../../validators"
import { shopOf } from "../../../shops"
import { orderView } from "../../../views"

/**
 * POST /admin/cp/ai/orders/:id/paid (owner, step-up; adr/0085 K11): a
 * pending request marked paid and its pack's credits added in the same
 * transaction; marked twice it adds once (`applied: false`). The audit
 * row names the shop, the credits and the amount.
 */
export async function POST(
  req: AuthenticatedMedusaRequest<PostAiOrderPaidType>,
  res: MedusaResponse
): Promise<void> {
  const done = await answeringAiConflicts(res, () =>
    markOrderPaid(req.scope, {
      orderId: paramOf(req, "id"),
      actor: actorOf(req),
      method: req.validatedBody.method,
      reference: req.validatedBody.reference ?? null,
      now: new Date(),
    })
  )
  if (done === undefined) {
    return
  }
  noteAuditChanges(req, {
    order: {
      tenant_id: done.order.tenant_id,
      to: "paid",
      applied: done.applied,
      credits: done.order.credits,
      amount: done.order.amount,
      method: done.order.method,
    },
  })
  res.json({
    applied: done.applied,
    order: orderView(done.order, await shopOf(req, done.order.tenant_id)),
  })
}
