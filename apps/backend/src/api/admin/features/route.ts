import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { PLATFORM_SETTINGS_MODULE } from "../../../modules/platform-settings"
import type PlatformSettingsModuleService from "../../../modules/platform-settings/service"

/** Every feature flag with its value, default, owner and labels (adr/0012). */
export async function GET(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const service = req.scope.resolve<PlatformSettingsModuleService>(PLATFORM_SETTINGS_MODULE)
  res.json({ features: await service.listFeatures() })
}
