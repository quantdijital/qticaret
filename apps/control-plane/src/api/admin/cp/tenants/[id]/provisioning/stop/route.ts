import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { startFromRequest } from "../../../provisioning"

/**
 * POST /admin/cp/tenants/:id/provisioning/stop (owner, operator, step-up):
 * the shop's backend stopped (its shop goes down: proved again). Only a
 * process the provisioner started for it; its data stays.
 */
export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  await startFromRequest(req, res, "stop")
}
