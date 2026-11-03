import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { cancelPaymentLinkWorkflow, linkById } from "../../../../../workflows/payment-links/manage"
import { linkSummaries } from "../../../../../workflows/payment-links/views"

/** POST /admin/payment-links/:id/cancel (adr/0051 §8): owner and admin; the code closes with it. */
export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  const id = req.params["id"] ?? ""
  await cancelPaymentLinkWorkflow(req.scope).run({
    input: { id, actor_id: req.auth_context.actor_id },
  })
  res.json({
    payment_link: (await linkSummaries(req.scope, [await linkById(req.scope, id)]))[0],
  })
}
