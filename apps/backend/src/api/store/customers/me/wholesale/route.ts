import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { wholesaleShopper } from "../../../../../workflows/wholesale/shopper"

/**
 * `GET /store/customers/me/wholesale` (ADR-0068 §7): whether the signed-in
 * customer buys at wholesale now, and what the storefront needs for it
 * (`vat_exclusive`: prices without KDV; `min_quantity`, slice 4). A
 * pending, closed or unknown account and a shop with the feature off all
 * answer `active: false`. Never the level's name nor a group. Personal:
 * kept by nobody on the way.
 */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  const wholesale = await wholesaleShopper(req.scope, req.auth_context.actor_id)
  res.setHeader("Cache-Control", "private, no-store")
  res.json({ wholesale })
}
