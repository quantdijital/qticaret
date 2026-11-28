import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { startFromRequest } from "../../../provisioning"

/**
 * POST /admin/cp/tenants/:id/provisioning/upgrade (owner, operator,
 * step-up): "Sürümü yükselt" (audit 3.1), the shop moved to its target
 * release: checked, backed up, stopped, migrated, started, healthy. A
 * failure stops the run at its step and says why on the run.
 */
export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  await startFromRequest(req, res, "upgrade")
}
