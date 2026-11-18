import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ConflictError } from "../../../../../lib/errors"
import { newBirfaturaToken } from "../../../../../lib/invoicing/birfatura"
import { INTEGRATION_CREDENTIALS_MODULE } from "../../../../../modules/integration-credentials"
import type IntegrationCredentialsModuleService from "../../../../../modules/integration-credentials/service"
import { PLATFORM_SETTINGS_MODULE } from "../../../../../modules/platform-settings"
import type { InvoicingSettings } from "../../../../../modules/platform-settings/sections"
import type PlatformSettingsModuleService from "../../../../../modules/platform-settings/service"
import { saveIntegrationCredentialsWorkflow } from "../../../../../workflows/integration-credentials/save-credentials"
import { birfaturaView } from "../view"

/**
 * POST /admin/einvoice/birfatura/token (adr/0072 §3): makes the shop's
 * BirFatura connection token, or a new one in its place (the old one stops
 * working at once). The owner alone, proving themselves again
 * (`OWNER_ONLY`, `requireReauth`), and only while BirFatura is the
 * invoicing program (409 otherwise: switching away removes the token, so
 * none waits unused). The server draws it; the module seals it before the
 * workflow, which stores it and tells every admin. Shown in this answer
 * once, never again; nothing else returns or logs it.
 */
export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  const { values } = await req.scope
    .resolve<PlatformSettingsModuleService>(PLATFORM_SETTINGS_MODULE)
    .readSection("invoicing")
  if ((values as unknown as InvoicingSettings).provider !== "birfatura") {
    throw new ConflictError("einvoice.birfatura_not_selected")
  }
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
