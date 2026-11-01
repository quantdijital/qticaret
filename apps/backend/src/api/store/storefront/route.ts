import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { PLATFORM_SETTINGS_MODULE } from "../../../modules/platform-settings"
import type {
  PromotionSettings,
  StorefrontSettings,
} from "../../../modules/platform-settings/sections"
import type PlatformSettingsModuleService from "../../../modules/platform-settings/service"

/**
 * GET /store/storefront (F18 D3, docs/19 §4): the storefront's frame as the
 * shop wrote it: the announcement bar's lines, the header's links, the
 * footer's columns, the trust strip and the WhatsApp number; and the free
 * shipping threshold (F4.5: `item_total`, KDV in, after discounts) for the
 * cart's "this much more" line. The shop's contact and legal details come
 * from `/store/legal-identity`.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const settings = req.scope.resolve<PlatformSettingsModuleService>(PLATFORM_SETTINGS_MODULE)
  const [storefront, promotions] = (await Promise.all([
    settings.getSection("storefront"),
    settings.getSection("promotions"),
  ])) as unknown as [StorefrontSettings, PromotionSettings]
  res.setHeader("Cache-Control", "public, max-age=300, stale-while-revalidate=3600")
  res.vary("x-publishable-api-key")
  res.json({ storefront, free_shipping_threshold: promotions.free_shipping_threshold })
}
