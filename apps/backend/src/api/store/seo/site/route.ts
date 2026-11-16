import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { SVG_MIME } from "../../../../lib/media/svg"
import { MEDIA_MODULE } from "../../../../modules/media"
import type MediaModuleService from "../../../../modules/media/service"
import { appleTouchOf } from "../../../../workflows/platform-settings/steps/favicon"
import { homeSeo } from "../../../../lib/seo/home"
import { siteJsonLd } from "../../../../lib/seo/jsonld"
import { SCHEMA_DAYS } from "../../../../lib/shop/hours"
import { SYSTEM_PAGES } from "../../../../lib/seo/paths"
import { PLATFORM_SETTINGS_MODULE } from "../../../../modules/platform-settings"
import { SEO_INDEXNOW } from "../../../../modules/platform-settings/features"
import type {
  AppearanceSettings,
  SeoSettings,
} from "../../../../modules/platform-settings/sections"
import type PlatformSettingsModuleService from "../../../../modules/platform-settings/service"
import { SEO_SITEMAPS_MODULE } from "../../../../modules/seo-sitemaps"
import type SeoSitemapsModuleService from "../../../../modules/seo-sitemaps/service"
import { storefrontTracking } from "../../../../workflows/conversions/tracking"
import { legalIdentity } from "../../../../workflows/legal/identity"
import type { LegalIdentity } from "../../../../workflows/legal/identity"
import { shopOf } from "../../../../workflows/seo/payload-sources"
import { planModeFor } from "../../../../lib/plan-guard"
import { siteMaintenance } from "../../../../workflows/storefront/maintenance"

/**
 * The site icon as the storefront's `<head>` names it: its address and
 * type, and Apple's home screen icon (the PNG itself; an SVG's own PNG, or
 * none when it could not be made). None chosen: all null.
 */
async function siteIcon(
  scope: MedusaRequest["scope"],
  url: string | null
): Promise<{
  favicon_url: string | null
  favicon_type: string | null
  apple_touch_url: string | null
}> {
  if (!url) {
    return { favicon_url: null, favicon_type: null, apple_touch_url: null }
  }
  const [asset] = await scope
    .resolve<MediaModuleService>(MEDIA_MODULE)
    .listMediaAssets({ url }, { select: ["mime_type", "derivatives"], take: 1 })
  const type = asset?.mime_type === SVG_MIME ? SVG_MIME : "image/png"
  return {
    favicon_url: url,
    favicon_type: type,
    apple_touch_url: type === SVG_MIME ? (appleTouchOf(asset?.derivatives)?.url ?? null) : url,
  }
}

const identityOf = (identity: LegalIdentity) => ({
  legalName: identity.company_title,
  taxID: identity.tax_number,
  address: identity.address,
  email: identity.contact_email,
  telephone: identity.contact_phone,
  sameAs: identity.same_as,
  hours: identity.opening_hours.map((range) => ({
    dayOfWeek: SCHEMA_DAYS[range.day] ?? "",
    opens: range.opens,
    closes: range.closes,
  })),
})

/**
 * `GET /store/seo/site` (docs/13 §2.2, §5, §6): what the storefront's edge
 * needs for every request: the canonical host (another host gets a 301
 * there), whether this instance may be indexed (if not, `X-Robots-Tag:
 * noindex` on every page), the IndexNow key to serve when the shop
 * announces its changes, and the home page's structured data, the shop
 * as an `OnlineStore` (with its legal identity, F13.9) and its `WebSite`. No blocks until the canonical
 * host is set: they need absolute URLs. And the robots value of the
 * storefront's own pages (search results, cart, account). For the
 * storefront's frame (F18, adr/0046): the shop's name, logo and site icon, and the
 * home page's `seo` object, shaped as resolve's for every other page. And
 * whether the shop is dark (adr/0053): the storefront answers 503 with
 * `Retry-After` and this page but for its system paths, the paths left
 * open and visitors holding a bypass link. And the browser tags' public
 * ids from the connected GA4 and Meta accounts, nothing else of them.
 * And whether the platform suspended the shop (adr/0061 Ek C15): the
 * storefront's 503 then, which no bypass link or open path of the shop's
 * opens.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const [shop, identity, maintenance, tracking, mode] = await Promise.all([
    shopOf(req.scope),
    legalIdentity(req.scope),
    siteMaintenance(req.scope),
    storefrontTracking(req.scope),
    planModeFor(req.scope),
  ])
  const settings = req.scope.resolve<PlatformSettingsModuleService>(PLATFORM_SETTINGS_MODULE)
  const [appearanceSection, seoSection, announcing] = await Promise.all([
    settings.getSection("appearance"),
    settings.getSection("seo"),
    settings.isFeatureEnabled(SEO_INDEXNOW),
  ])
  const appearance = appearanceSection as unknown as AppearanceSettings
  const seo = seoSection as unknown as SeoSettings
  const url = shop.canonicalHost ? `https://${shop.canonicalHost}/` : null
  const jsonLd = url
    ? siteJsonLd({ name: shop.name, url, logo: appearance.logo_light_url }, identityOf(identity))
    : []
  // Never kept on the way (adr/0061 Ek C15 review I1): maintenance and a suspension must
  // reach the storefront, which asks at most once a minute per process and is told at
  // once by the refresh signal; a shared cache could hold either for hours
  res.setHeader("Cache-Control", "no-store")
  res.vary("x-publishable-api-key")
  res.json({
    canonical_host: shop.canonicalHost,
    indexing: shop.indexing,
    // Served by the storefront at `/{key}.txt` while the shop announces its changes
    indexnow_key: announcing
      ? await req.scope.resolve<SeoSitemapsModuleService>(SEO_SITEMAPS_MODULE).indexNowKey()
      : null,
    jsonLd,
    system_pages: SYSTEM_PAGES,
    // The site icon the shop chose, its type and Apple's home screen PNG; null: the storefront's own
    shop: {
      name: shop.name,
      logo_url: appearance.logo_light_url,
      ...(await siteIcon(req.scope, appearance.favicon_url ?? null)),
    },
    home: homeSeo({ shop, home: seo.home, ogImage: seo.default_og_image, jsonLd }),
    maintenance,
    tracking,
    // adr/0061 Ek C15: only whether the platform suspended it; a restricted shop sells
    suspended: mode === "suspended",
  })
}
