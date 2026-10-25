import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { SEO_SITEMAPS_MODULE } from "../../../../modules/seo-sitemaps"
import type SeoSitemapsModuleService from "../../../../modules/seo-sitemaps/service"
import { shopOf } from "../../../../workflows/seo/payload-sources"

/**
 * The sitemap's state for the panel (docs/13 §6): its files and URL
 * counts, when it came out, and whether changes wait for the next run.
 * Regenerating now is the `seo.sitemap` job.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const service = req.scope.resolve<SeoSitemapsModuleService>(SEO_SITEMAPS_MODULE)
  const [state, files, shop] = await Promise.all([
    service.currentState(),
    service.listSitemapFiles(
      {},
      { select: ["name", "url_count", "generated_at"], order: { name: "ASC" } }
    ),
    shopOf(req.scope),
  ])
  res.json({
    host_missing: shop.canonicalHost === null,
    indexing: shop.indexing,
    generated_at: state?.generated_at ?? null,
    dirty_since: state?.dirty_since ?? null,
    files: files.map((file) => ({ name: file.name, urls: file.url_count })),
  })
}
