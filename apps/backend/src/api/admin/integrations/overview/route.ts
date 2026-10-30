import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { integrationOverview } from "../../../../workflows/integrations/overview"

/**
 * GET /admin/integrations/overview (F12.2): every outside service the shop
 * uses, where it stands and its last failed calls. No secret; owner and
 * admin only (adr/0040), people only.
 */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  res.json({ integrations: await integrationOverview(req.scope) })
}
