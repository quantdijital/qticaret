import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { siteJsonLd } from "../../../../lib/seo/jsonld"
import { SYSTEM_PAGES } from "../../../../lib/seo/paths"
import { PLATFORM_SETTINGS_MODULE } from "../../../../modules/platform-settings"
import { SEO_INDEXNOW } from "../../../../modules/platform-settings/features"
import type { AppearanceSettings } from "../../../../modules/platform-settings/sections"
import type PlatformSettingsModuleService from "../../../../modules/platform-settings/service"
import { SEO_SITEMAPS_MODULE } from "../../../../modules/seo-sitemaps"
import type SeoSitemapsModuleService from "../../../../modules/seo-sitemaps/service"
import { shopOf } from "../../../../workflows/seo/payload-sources"

/**
 * `GET /store/seo/site` (docs/13 §2.2, §5, §6): what the storefront's edge
 * needs for every request: the canonical host (another host gets a 301
 * there), whether this instance may be indexed (if not, `X-Robots-Tag:
 * noindex` on every page), the IndexNow key to serve when the shop
 * announces its changes, and the home page's structured data, the shop
 * as an `OnlineStore` and its `WebSite`. No blocks until the canonical
 * host is set: they need absolute URLs. And the robots value of the
 * storefront's own pages (search results, cart, account).
 */
export async function GET(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const shop = await shopOf(req.scope)
  const appearance = (await req.scope
    .resolve<PlatformSettingsModuleService>(PLATFORM_SETTINGS_MODULE)
    .getSection("appearance")) as unknown as AppearanceSettings
  const url = shop.canonicalHost ? `https://${shop.canonicalHost}/` : null
  const announcing = await req.scope
    .resolve<PlatformSettingsModuleService>(PLATFORM_SETTINGS_MODULE)
    .isFeatureEnabled(SEO_INDEXNOW)
  res.setHeader("Cache-Control", "public, max-age=300, stale-while-revalidate=3600")
  res.vary("x-publishable-api-key")
  res.json({
    canonical_host: shop.canonicalHost,
    indexing: shop.indexing,
    // Served by the storefront at `/{key}.txt` while the shop announces its changes
    indexnow_key: announcing
      ? await req.scope.resolve<SeoSitemapsModuleService>(SEO_SITEMAPS_MODULE).indexNowKey()
      : null,
    jsonLd: url ? siteJsonLd({ name: shop.name, url, logo: appearance.logo_light_url }) : [],
    system_pages: SYSTEM_PAGES,
  })
}
