import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { PLATFORM_SETTINGS_MODULE } from "../../../../modules/platform-settings"
import type PlatformSettingsModuleService from "../../../../modules/platform-settings/service"
import { setFeatureFlagWorkflow } from "../../../../workflows/platform-settings/set-feature-flag"
import type { AdminPostFeatureType } from "../../platform-settings/validators"

/**
 * Turns a tenant flag on or off. An unknown flag is 404 and a platform flag
 * (set by provisioning) is refused, both by the service.
 */
export async function POST(
  req: AuthenticatedMedusaRequest<AdminPostFeatureType>,
  res: MedusaResponse
): Promise<void> {
  const key = req.params["key"] ?? ""
  await setFeatureFlagWorkflow(req.scope).run({
    input: { key, enabled: req.validatedBody.enabled, actor_id: req.auth_context.actor_id || null },
  })
  const service = req.scope.resolve<PlatformSettingsModuleService>(PLATFORM_SETTINGS_MODULE)
  const feature = (await service.listFeatures()).find((item) => item.key === key)
  res.json({ feature })
}
