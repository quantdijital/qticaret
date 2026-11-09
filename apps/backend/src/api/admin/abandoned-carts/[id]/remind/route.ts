import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { staffRemindCartWorkflow } from "../../../../../workflows/marketing/staff-remind-cart"

/**
 * POST /admin/abandoned-carts/:id/remind (2026-11-06): "E-posta ile
 * hatırlat", the cart's one reminder now. 409 with the reason when it may
 * not go (no consent, already reminded...); otherwise what the send came
 * to (`sent`, `channel_off`, `over_quota`...).
 */
export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  const { result } = await staffRemindCartWorkflow(req.scope).run({
    input: { cart_id: req.params["id"] ?? "" },
  })
  res.json({ outcome: result.outcome })
}
