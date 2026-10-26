import type { MedusaContainer } from "@medusajs/framework/types"
import { parseEnv } from "../../../lib/env"
import { brandPath, categoryPath, collectionPath, productPath } from "../../../lib/seo"
import { hostFinding, robotsFinding, sitemapFinding } from "../../../lib/seo/audit"
import type { AuditFinding } from "../../../lib/seo/audit"
import { robotsTxt } from "../../../lib/seo/robots"
import { ASYNC_JOB_MODULE } from "../../../modules/async-job"
import type AsyncJobModuleService from "../../../modules/async-job/service"
import { PLATFORM_SETTINGS_MODULE } from "../../../modules/platform-settings"
import type { SeoSettings } from "../../../modules/platform-settings/sections"
import type PlatformSettingsModuleService from "../../../modules/platform-settings/service"
import { SEO_SITEMAPS_MODULE } from "../../../modules/seo-sitemaps"
import type SeoSitemapsModuleService from "../../../modules/seo-sitemaps/service"
import { shopOf } from "../payload-sources"
import { sitemapCounts } from "../sitemap-build"

/** The home page and a page of each kind in the shop's URL style: what robots.txt must let in. */
const samplePages = (style: SeoSettings["url_style"]): string[] => [
  "/",
  productPath("ornek-urun", style.product),
  categoryPath(["ornek-kategori"], style.category),
  brandPath("ornek-marka", style.brand),
  collectionPath("ornek-koleksiyon"),
]

/** S-HOST-01, S-ROBOTS-01 and S-SITEMAP-01: what lets search engines in and shows them around. */
export async function siteFindings(
  container: MedusaContainer,
  now: Date
): Promise<(AuditFinding | null)[]> {
  const shop = await shopOf(container)
  const seo = (await container
    .resolve<PlatformSettingsModuleService>(PLATFORM_SETTINGS_MODULE)
    .getSection("seo")) as unknown as SeoSettings
  const hasHost = Boolean(shop.canonicalHost)
  // What `/robots.txt` serves now, built as its route builds it
  const robots = robotsTxt({
    template: seo.robots_txt,
    sitemapUrl: hasHost ? `https://${String(shop.canonicalHost)}/sitemap.xml` : null,
    preset: seo.ai_crawler_preset,
    indexing: shop.indexing,
  })

  const sitemaps = container.resolve<SeoSitemapsModuleService>(SEO_SITEMAPS_MODULE)
  const state = await sitemaps.currentState()
  const files = await sitemaps.listSitemapFiles({}, { select: ["name", "url_count"] })
  const [lastRun] = await container
    .resolve<AsyncJobModuleService>(ASYNC_JOB_MODULE)
    .listAsyncJobs(
      { type: "seo.sitemap", status: ["succeeded", "failed"] },
      { order: { created_at: "DESC" }, take: 1, select: ["status"] }
    )
  const counts = hasHost ? await sitemapCounts(container) : { expected: 0, pathless: 0 }

  return [
    hostFinding({
      host: shop.canonicalHost,
      isIndexingOn: shop.indexing,
      isStaging: parseEnv().NODE_ENV === "staging",
    }),
    // A shop kept out of search on purpose is S-HOST-01's finding, not its robots file's
    shop.indexing ? robotsFinding(robots, hasHost, samplePages(seo.url_style)) : null,
    sitemapFinding(
      {
        hasHost,
        generatedAt: state?.generated_at ? new Date(state.generated_at) : null,
        isDirty: Boolean(state?.dirty_since),
        hasFailedRun: lastRun?.status === "failed",
        urls: files.reduce((total, file) => total + file.url_count, 0),
        ...counts,
      },
      now
    ),
  ]
}
