import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
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
import { legalIdentity } from "../../../../workflows/legal/identity"
import type { LegalIdentity } from "../../../../workflows/legal/identity"
import { shopOf } from "../../../../workflows/seo/payload-sources"
import { siteMaintenance } from "../../../../workflows/storefront/maintenance"

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
 * storefront's frame (F18, adr/0046): the shop's name and logo, and the
 * home page's `seo` object, shaped as resolve's for every other page. And
 * whether the shop is dark (adr/0053): the storefront answers 503 with
 * `Retry-After` and this page but for its system paths, the paths left
 * open and visitors holding a bypass link.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const [shop, identity, maintenance] = await Promise.all([
    shopOf(req.scope),
    legalIdentity(req.scope),
    siteMaintenance(req.scope),
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
  res.setHeader("Cache-Control", "public, max-age=300, stale-while-revalidate=3600")
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
    shop: { name: shop.name, logo_url: appearance.logo_light_url },
    home: homeSeo({ shop, home: seo.home, ogImage: seo.default_og_image, jsonLd }),
    maintenance,
  })
}
