import type { MedusaContainer } from "@medusajs/framework/types"
import { parseEnv } from "../../../lib/env"
import { brandPath, categoryPath, collectionPath, productPath } from "../../../lib/seo"
import { hostFinding, robotsFinding, sitemapFinding } from "../../../lib/seo/audit"
import type { AuditFinding } from "../../../lib/seo/audit"
import { LISTING_PARAMS } from "../../../lib/seo/facets"
import { robotsTxt } from "../../../lib/seo/robots"
import { ASYNC_JOB_MODULE } from "../../../modules/async-job"
import type AsyncJobModuleService from "../../../modules/async-job/service"
import { PLATFORM_SETTINGS_MODULE } from "../../../modules/platform-settings"
import type { SeoSettings } from "../../../modules/platform-settings/sections"
import type PlatformSettingsModuleService from "../../../modules/platform-settings/service"
import { SEO_SITEMAPS_MODULE } from "../../../modules/seo-sitemaps"
import type SeoSitemapsModuleService from "../../../modules/seo-sitemaps/service"
import { listingFilterKeys } from "../listing"
import { shopOf } from "../payload-sources"
import { sitemapCounts } from "../sitemap-build"

/** The home page and a page of each kind in the shop's URL style: what robots.txt must let in. */
const samplePages = (style: SeoSettings["url_style"]): string[] => [
  "/",
  productPath("ornek-urun", style.product),
  categoryPath(["ornek-kategori"], style.category),
  // A subcategory: the prefixed and nested styles carry the tree (adr/0017 Ek 2026-11-23)
  categoryPath(["ornek-kategori", "ornek-alt-kategori"], style.category),
  // A facet landing page sits under its category (F3.16)
  `${categoryPath(["ornek-kategori"], style.category)}/ornek-filtre`,
  brandPath("ornek-marka", style.brand),
  collectionPath("ornek-koleksiyon"),
]

// Filtered, priced and sorted listings the file should keep crawlers off (docs/13 §7):
// each kind of parameter, and one of the shop's own filters
const sampleFacets = (style: SeoSettings["url_style"], filterKeys: Set<string>): string[] => {
  const category = categoryPath(["ornek-kategori"], style.category)
  const [filter] = [...filterKeys].sort()
  return [
    `${category}?${LISTING_PARAMS.brand}=ornek-marka`,
    ...(filter ? [`${category}?${filter}=ornek-deger`] : []),
    `${category}?${LISTING_PARAMS.price}=100-500`,
    `${category}?${LISTING_PARAMS.page}=2&${LISTING_PARAMS.sort}=yeni`,
  ]
}

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
  const filterKeys = await listingFilterKeys(container)
  // What `/robots.txt` serves now, built as its route builds it
  const robots = robotsTxt({
    template: seo.robots_txt,
    sitemapUrl: hasHost ? `https://${String(shop.canonicalHost)}/sitemap.xml` : null,
    preset: seo.ai_crawler_preset,
    indexing: shop.indexing,
    filterKeys,
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
    shop.indexing
      ? robotsFinding(
          robots,
          hasHost,
          samplePages(seo.url_style),
          sampleFacets(seo.url_style, filterKeys)
        )
      : null,
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
