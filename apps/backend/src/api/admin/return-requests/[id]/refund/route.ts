import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { refundReturn } from "../../../../../workflows/returns/receive-return"

/** POST /admin/return-requests/:id/refund: gives a received return's money back (again, once). */
export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  const refunded = await refundReturn(req.scope, {
    id: req.params["id"] ?? "",
    staff_id: req.auth_context.actor_id,
  })
  res.json({ return_request: refunded })
}
