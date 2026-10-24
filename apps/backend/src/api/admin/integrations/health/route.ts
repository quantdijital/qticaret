import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { integrationHealth } from "../../../../lib/integrations/health"

/**
 * GET /admin/integrations/health (F2.6): external dependencies in parallel,
 * each time-limited, the report cached for 30 s. Admin authentication comes
 * from Medusa's /admin default. Core /health stays a plain liveness check.
 */
export const GET = async (_req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  res.json(await integrationHealth().report())
}
