import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { siteJsonLd } from "../../../../lib/seo/jsonld"
import { PLATFORM_SETTINGS_MODULE } from "../../../../modules/platform-settings"
import type { AppearanceSettings } from "../../../../modules/platform-settings/sections"
import type PlatformSettingsModuleService from "../../../../modules/platform-settings/service"
import { shopOf } from "../../../../workflows/seo/payload-sources"

/**
 * `GET /store/seo/site` (docs/13 §2.2, §5, §6): what the storefront's edge
 * needs for every request: the canonical host (another host gets a 301
 * there), whether this instance may be indexed (if not, `X-Robots-Tag:
 * noindex` on every page), and the home page's structured data, the shop
 * as an `OnlineStore` and its `WebSite`. No blocks until the canonical
 * host is set: they need absolute URLs.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const shop = await shopOf(req.scope)
  const appearance = (await req.scope
    .resolve<PlatformSettingsModuleService>(PLATFORM_SETTINGS_MODULE)
    .getSection("appearance")) as unknown as AppearanceSettings
  const url = shop.canonicalHost ? `https://${shop.canonicalHost}/` : null
  res.setHeader("Cache-Control", "public, max-age=300, stale-while-revalidate=3600")
  res.vary("x-publishable-api-key")
  res.json({
    canonical_host: shop.canonicalHost,
    indexing: shop.indexing,
    jsonLd: url ? siteJsonLd({ name: shop.name, url, logo: appearance.logo_light_url }) : [],
  })
}
