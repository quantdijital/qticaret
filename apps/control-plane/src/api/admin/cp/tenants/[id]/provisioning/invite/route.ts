import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { startFromRequest } from "../../../provisioning"

/**
 * POST /admin/cp/tenants/:id/provisioning/invite (owner, operator,
 * step-up): the owner's invitation sent again ("Yeniden gönder"): a new
 * link to the shop's owner contact, the old one void. It opens the shop's
 * owner account, so it is proved again. Nothing once the shop has staff.
 */
export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  await startFromRequest(req, res, "invite")
}
