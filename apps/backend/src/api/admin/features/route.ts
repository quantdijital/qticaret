import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { contentDraftProvider } from "../../../lib/content-drafts/provider"
import { PLATFORM_SETTINGS_MODULE } from "../../../modules/platform-settings"
import type PlatformSettingsModuleService from "../../../modules/platform-settings/service"
import { listedFeatures } from "./listed"

/**
 * Every feature flag with its value, default, owner and labels (adr/0012),
 * but those this instance cannot use (`listed.ts`).
 */
export async function GET(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const service = req.scope.resolve<PlatformSettingsModuleService>(PLATFORM_SETTINGS_MODULE)
  res.json({
    features: listedFeatures(await service.listFeatures(), {
      contentDrafts: contentDraftProvider() !== null,
    }),
  })
}
