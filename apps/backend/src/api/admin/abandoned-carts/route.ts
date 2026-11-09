import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { listAbandonedCarts } from "../../../workflows/marketing/abandoned-cart-reads"
import type { AdminGetAbandonedCartsType } from "./validators"

/**
 * GET /admin/abandoned-carts (2026-11-06): carts left behind over the last
 * 30 days with their shopper, lines, value, last activity, reminder and
 * consent. Owner, admin and operations; a recorded read.
 */
export async function GET(
  req: AuthenticatedMedusaRequest<unknown, AdminGetAbandonedCartsType>,
  res: MedusaResponse
): Promise<void> {
  const { limit, offset } = req.validatedQuery as AdminGetAbandonedCartsType
  res.json({ ...(await listAbandonedCarts(req.scope, { limit, offset })), limit, offset })
}
