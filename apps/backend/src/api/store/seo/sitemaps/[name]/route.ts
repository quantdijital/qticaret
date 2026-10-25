import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { SEO_SITEMAPS_MODULE } from "../../../../../modules/seo-sitemaps"
import type SeoSitemapsModuleService from "../../../../../modules/seo-sitemaps/service"

// `sitemap.xml` (the index) and the files it names
const NAME = /^sitemap(?:-[a-z]+-\d{1,4})?\.xml$/

/**
 * `GET /store/seo/sitemaps/:name` (docs/13 §6): a generated sitemap file
 * as XML; the storefront serves it at `/sitemap.xml` and `/:name`.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const name = req.params["name"] ?? ""
  const [file] = NAME.test(name)
    ? await req.scope
        .resolve<SeoSitemapsModuleService>(SEO_SITEMAPS_MODULE)
        .listSitemapFiles({ name }, { take: 1 })
    : []
  if (!file) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "seo.sitemap_unknown")
  }
  res.setHeader("Content-Type", "application/xml; charset=utf-8")
  res.setHeader("X-Content-Type-Options", "nosniff")
  res.setHeader("Cache-Control", "public, max-age=3600, stale-while-revalidate=86400")
  res.setHeader("Last-Modified", new Date(file.generated_at).toUTCString())
  res.vary("x-publishable-api-key")
  res.send(file.content)
}
