import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { integrationHealth } from "../../../../lib/integrations/health"
import { INTEGRATION_CREDENTIALS_MODULE } from "../../../../modules/integration-credentials"
import type IntegrationCredentialsModuleService from "../../../../modules/integration-credentials/service"

/**
 * GET /admin/integrations/health (F2.6): external dependencies in parallel,
 * each time-limited, the report cached for 30 s. Admin authentication comes
 * from Medusa's /admin default. Core /health stays a plain liveness check.
 */
export const GET = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const accounts = req.scope.resolve<IntegrationCredentialsModuleService>(
    INTEGRATION_CREDENTIALS_MODULE
  )
  res.json(await integrationHealth(accounts).report())
}
