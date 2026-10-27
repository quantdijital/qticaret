import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { INTEGRATION_CREDENTIALS_MODULE } from "../../../../../../modules/integration-credentials"
import type IntegrationCredentialsModuleService from "../../../../../../modules/integration-credentials/service"
import { checkIntegrationCredentialsWorkflow } from "../../../../../../workflows/integration-credentials/check-credentials"
import { providerParam } from "../../provider-param"

/** POST /admin/integrations/credentials/:provider/check: "test the connection" (adr/0027 §4). */
export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  const provider = providerParam(req)
  const { result } = await checkIntegrationCredentialsWorkflow(req.scope).run({ input: provider })
  const service = req.scope.resolve<IntegrationCredentialsModuleService>(
    INTEGRATION_CREDENTIALS_MODULE
  )
  res.json({ account: await service.describe(provider), check: result })
}
