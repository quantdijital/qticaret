import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { googleClientOf } from "../../../lib/google/oauth"
import { GOOGLE_MERCHANT_MODULE } from "../../../modules/google-merchant"
import type GoogleMerchantModuleService from "../../../modules/google-merchant/service"
import { INTEGRATION_CREDENTIALS_MODULE } from "../../../modules/integration-credentials"
import type IntegrationCredentialsModuleService from "../../../modules/integration-credentials/service"
import { disconnectGoogleWorkflow } from "../../../workflows/google/merchant"

/**
 * GET /admin/google (F10 M13): whether the platform's Google client is
 * set up, which Google account the shop connected, its Merchant Center
 * account and the last run that sent its products. No token leaves.
 */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  const [status] = await req.scope
    .resolve<IntegrationCredentialsModuleService>(INTEGRATION_CREDENTIALS_MODULE)
    .describeAll()
    .then((all) => all.filter((each) => each.provider === "google"))
  const [sync] = await req.scope
    .resolve<GoogleMerchantModuleService>(GOOGLE_MERCHANT_MODULE)
    .listMerchantSyncs({}, { take: 1 })
  const settings: Record<string, unknown> = status?.settings ?? {}
  res.json({
    google: {
      configured: googleClientOf() !== null,
      connected: status !== undefined && status.state !== "not_configured",
      state: status?.state ?? "not_configured",
      email: typeof settings["email"] === "string" ? settings["email"] : null,
      merchant_id: typeof settings["merchant_id"] === "string" ? settings["merchant_id"] : null,
      last_sync: sync
        ? {
            at: sync.created_at,
            sent: sync.sent,
            removed: sync.removed,
            failed: sync.failed,
            error: sync.error,
          }
        : null,
    },
  })
}

/** DELETE /admin/google: the shop's Google account disconnected; its access ends at Google. */
export async function DELETE(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  await disconnectGoogleWorkflow(req.scope).run({ input: { user_id: req.auth_context.actor_id } })
  res.json({ connected: false })
}
