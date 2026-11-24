import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { isSearchIndexingOn, parseEnv } from "../../../../lib/env"
import { robotsTxt } from "../../../../lib/seo/robots"
import { PLATFORM_SETTINGS_MODULE } from "../../../../modules/platform-settings"
import type { SeoSettings } from "../../../../modules/platform-settings/sections"
import type PlatformSettingsModuleService from "../../../../modules/platform-settings/service"
import { listingFilterKeys } from "../../../../workflows/seo/listing"
import { varyOnPublishableKey } from "../../../../lib/http/vary"

/**
 * `GET /store/seo/robots` (docs/13 §6, §9): the shop's robots.txt, served
 * by the storefront at `/robots.txt`. Plain text that is never sniffed.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const seo = (await req.scope
    .resolve<PlatformSettingsModuleService>(PLATFORM_SETTINGS_MODULE)
    .getSection("seo")) as unknown as SeoSettings
  res.setHeader("Content-Type", "text/plain; charset=utf-8")
  res.setHeader("X-Content-Type-Options", "nosniff")
  res.setHeader("Cache-Control", "public, max-age=300, stale-while-revalidate=3600")
  varyOnPublishableKey(res)
  res.send(
    robotsTxt({
      template: seo.robots_txt,
      sitemapUrl: seo.canonical_host ? `https://${seo.canonical_host}/sitemap.xml` : null,
      preset: seo.ai_crawler_preset,
      indexing: isSearchIndexingOn(parseEnv()),
      filterKeys: await listingFilterKeys(req.scope),
    })
  )
}
