import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { newBirfaturaToken } from "../../../../../lib/invoicing/birfatura"
import { INTEGRATION_CREDENTIALS_MODULE } from "../../../../../modules/integration-credentials"
import type IntegrationCredentialsModuleService from "../../../../../modules/integration-credentials/service"
import { saveIntegrationCredentialsWorkflow } from "../../../../../workflows/integration-credentials/save-credentials"
import { birfaturaView } from "../view"

/**
 * POST /admin/einvoice/birfatura/token (adr/0072 §3): makes the shop's
 * BirFatura connection token, or a new one in its place (the old one stops
 * working at once). The owner alone, proving themselves again
 * (`OWNER_ONLY`, `requireReauth`). The server draws it; the module seals
 * it before the workflow, which stores it and tells every admin. Shown in
 * this answer once, never again; nothing else returns or logs it.
 */
export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  const token = newBirfaturaToken()
  const draft = await req.scope
    .resolve<IntegrationCredentialsModuleService>(INTEGRATION_CREDENTIALS_MODULE)
    .draft("birfatura", { settings: {}, secrets: { token } })
  await saveIntegrationCredentialsWorkflow(req.scope).run({
    input: { draft, actor_id: req.auth_context.actor_id || null },
  })
  res.setHeader("Cache-Control", "no-store")
  res.json({ token, birfatura: await birfaturaView(req) })
}
