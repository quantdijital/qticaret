import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { startFromRequest } from "../../../provisioning"

/**
 * POST /admin/cp/tenants/:id/provisioning/apply-pack (owner, operator,
 * step-up): the shop's sector pack applied again ("Paketi yeniden uygula",
 * C12), an `apply_pack` run of the setup's one step. Only adds what the
 * shop never had (a newer pack version's items); it writes into the
 * shop's catalog and settings, so it is proved again.
 */
export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  await startFromRequest(req, res, "apply_pack")
}
