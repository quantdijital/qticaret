import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { abandonedCartDetail } from "../../../../workflows/marketing/abandoned-cart-reads"

/**
 * GET /admin/abandoned-carts/:id (2026-11-06): one cart left behind, all
 * its lines, the phone whole, and whether it may be reminded by e-mail or
 * written to on WhatsApp (and if not, why). A recorded read.
 */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  res.json({ cart: await abandonedCartDetail(req.scope, req.params["id"] ?? "") })
}
