import { z } from "@medusajs/framework/zod"
import { SEO_SITEMAPS_MODULE } from "../../../modules/seo-sitemaps"
import type SeoSitemapsModuleService from "../../../modules/seo-sitemaps/service"
import { buildSitemap } from "../../seo/sitemap-build"
import type { JobType } from "./types"

/**
 * Regenerates the sitemap (docs/13 §6): every file built, then swapped in
 * at once. Without a canonical host there is nothing to build (URLs must
 * be absolute) and the old files go.
 */
export const seoSitemap: JobType<Record<string, never>> = {
  input: z.object({}).strict(),
  singleton: true,
  resultTtlDays: 7,
  containsPersonalData: false,
  execute: async ({ container, progress }) => {
    const startedAt = new Date()
    await progress(5)
    const built = await buildSitemap(container)
    await progress(90)
    await container.resolve<SeoSitemapsModuleService>(SEO_SITEMAPS_MODULE).replaceFiles(
      (built?.files ?? []).map(({ name, content, urls }) => ({ name, content, url_count: urls })),
      startedAt
    )
    return {
      summary: built
        ? { files: built.files.length, urls: built.urls }
        : { files: 0, urls: 0, host_missing: true },
    }
  },
}
