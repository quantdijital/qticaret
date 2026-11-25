import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { cancelOrderAsStaff } from "../../../../../../../lib/ai-credits/grant"
import { noteAuditChanges } from "../../../../../../http/audit"
import { actorOf, paramOf } from "../../../../tenants/params"
import { orderView } from "../../../views"

/**
 * POST /admin/cp/ai/orders/:id/cancel (owner, step-up; adr/0085 K11): a
 * pending request cancelled; a paid or cancelled one is
 * `cp.ai_credit_order_closed`. The audit row names the shop.
 */
export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  const order = await cancelOrderAsStaff(req.scope, {
    orderId: paramOf(req, "id"),
    actor: actorOf(req),
    now: new Date(),
  })
  noteAuditChanges(req, {
    order: { tenant_id: order.tenant_id, to: "cancelled", credits: order.credits },
  })
  res.json({ order: orderView(order) })
}
