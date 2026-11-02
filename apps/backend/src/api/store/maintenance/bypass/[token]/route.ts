import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { orderAccessKey } from "../../../../../lib/orders/access-token"
import { bypassOpens, bypassParts } from "../../../../../lib/storefront/maintenance"
import { maintenanceState } from "../../../../../workflows/storefront/maintenance"

/**
 * GET /store/maintenance/bypass/:token (adr/0053): 204 while the link opens
 * the dark shop (the shop is dark, the section unsaved since the link was
 * made, the week not over); 404 for anything else, as if there were no such
 * link. The storefront asks before setting its cookie, and again while the
 * cookie is in use.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  res.setHeader("Cache-Control", "private, no-store")
  // A malformed or ended token costs no read
  const parts = bypassParts(req.params["token"] ?? "")
  const state = parts ? await maintenanceState(req.scope) : null
  if (!parts || !state?.enabled || !bypassOpens(orderAccessKey(), parts, state.version)) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "maintenance.bypass_unknown")
  }
  res.sendStatus(204)
}
