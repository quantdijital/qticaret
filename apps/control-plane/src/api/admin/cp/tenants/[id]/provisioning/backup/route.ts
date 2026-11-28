import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { startFromRequest } from "../../../provisioning"

/**
 * POST /admin/cp/tenants/:id/provisioning/backup (owner, operator,
 * step-up): "Şimdi yedekle" (audit 3.2), the shop's database and files
 * encrypted by `infra/backup/backup.sh`. Restore stays the runbook's.
 */
export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  await startFromRequest(req, res, "backup")
}
