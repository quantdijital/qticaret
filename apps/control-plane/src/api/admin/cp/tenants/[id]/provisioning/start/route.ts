import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { startFromRequest } from "../../../provisioning"

/**
 * POST /admin/cp/tenants/:id/provisioning/start (owner, operator,
 * step-up): the shop's backend started again and its health waited for;
 * undone (stopped) when it does not come up.
 */
export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  await startFromRequest(req, res, "start")
}
