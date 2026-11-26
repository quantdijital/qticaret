import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { INTEGRATION_CREDENTIALS_MODULE } from "../../../../modules/integration-credentials"
import type IntegrationCredentialsModuleService from "../../../../modules/integration-credentials/service"
import { unavailableProviders } from "../../../../lib/integrations/available"
import { listedHere } from "./provider-param"

/**
 * GET /admin/integrations/credentials: every provider the shop can connect
 * and its state (adr/0027). No secret, nor any part of one, is returned.
 * One kept on its own page (BirFatura's token) is not listed here.
 * `unavailable`: providers this server cannot connect (no platform app set).
 */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  const service = req.scope.resolve<IntegrationCredentialsModuleService>(
    INTEGRATION_CREDENTIALS_MODULE
  )
  const accounts = (await service.describeAll()).filter((account) => listedHere(account.provider))
  res.json({
    key_configured: service.isKeyConfigured(),
    unavailable: unavailableProviders(),
    accounts,
  })
}
