import type { MedusaContainer } from "@medusajs/framework/types"
import { PLATFORM_SETTINGS_MODULE } from "../../../modules/platform-settings"
import { SEO_PUBLISH_GATE } from "../../../modules/platform-settings/features"
import type PlatformSettingsModuleService from "../../../modules/platform-settings/service"
import { assessPage } from "./assess"

// docs/14 §2: below "needs work" a page is not ready for search
export const PUBLISH_GATE_SCORE = 50

/**
 * The SEO publish gate (docs/14 §2, flag `seo.publish_gate`): a product with
 * a critical finding (no price, no image) or a score below 50 does not go
 * live. Null while the flag is off; otherwise whether the product, as
 * stored, is held back. Shared by the product route and our own writers
 * (bulk edit, import) that set a status without that route.
 */
export async function publishGate(
  container: MedusaContainer
): Promise<((productId: string) => Promise<boolean>) | null> {
  const settings = container.resolve<PlatformSettingsModuleService>(PLATFORM_SETTINGS_MODULE)
  if (!(await settings.isFeatureEnabled(SEO_PUBLISH_GATE))) {
    return null
  }
  return async (productId) => {
    const assessment = await assessPage(container, "product", productId)
    const critical = assessment?.issues.some((issue) => issue.severity === "critical") ?? false
    return assessment !== null && (critical || assessment.score < PUBLISH_GATE_SCORE)
  }
}
