import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { INTEGRATION_CREDENTIALS_MODULE } from "../../../../../modules/integration-credentials"
import type IntegrationCredentialsModuleService from "../../../../../modules/integration-credentials/service"
import { removeIntegrationCredentialsWorkflow } from "../../../../../workflows/integration-credentials/remove-credentials"
import { saveIntegrationCredentialsWorkflow } from "../../../../../workflows/integration-credentials/save-credentials"
import { providerParam } from "../provider-param"
import type { AdminPostCredentialsType } from "../validators"

const serviceOf = (req: AuthenticatedMedusaRequest) =>
  req.scope.resolve<IntegrationCredentialsModuleService>(INTEGRATION_CREDENTIALS_MODULE)

/**
 * POST /admin/integrations/credentials/:provider: connects or updates the
 * shop's account. The module seals it first, so the workflow never holds
 * a secret in the clear; the provider is asked before it is stored.
 */
export async function POST(
  req: AuthenticatedMedusaRequest<AdminPostCredentialsType>,
  res: MedusaResponse
): Promise<void> {
  const provider = providerParam(req)
  const service = serviceOf(req)
  const draft = await service.draft(provider, req.validatedBody)
  const { result } = await saveIntegrationCredentialsWorkflow(req.scope).run({
    input: { draft, actor_id: req.auth_context.actor_id || null },
  })
  res.json({ account: await service.describe(provider), check: result.check })
}

/** DELETE /admin/integrations/credentials/:provider: disconnects; the stored account is deleted. */
export async function DELETE(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  const provider = providerParam(req)
  await removeIntegrationCredentialsWorkflow(req.scope).run({
    input: { provider, actor_id: req.auth_context.actor_id || null },
  })
  res.json({ account: await serviceOf(req).describe(provider) })
}
