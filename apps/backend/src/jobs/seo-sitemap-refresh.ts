import type { MedusaContainer } from "@medusajs/framework/types"
import { isConflictError } from "../lib/errors"
import { logger } from "../lib/logging"
import { SEO_SITEMAPS_MODULE } from "../modules/seo-sitemaps"
import type SeoSitemapsModuleService from "../modules/seo-sitemaps/service"
import { enqueueAsyncJobWorkflow } from "../workflows/async-job/enqueue-async-job"

// Changes settle this long before a rebuild, so a bulk edit makes one run
const SETTLE_MS = 2 * 60 * 1000
// A full rebuild at least this often, changes or not (docs/13 §6: daily)
const FULL_EVERY_MS = 24 * 60 * 60 * 1000

/**
 * Queues the sitemap job (docs/13 §6) once changes have settled, and once
 * a day in any case. A run already queued or running is left alone.
 */
export default async function seoSitemapRefresh(container: MedusaContainer) {
  const state = await container
    .resolve<SeoSitemapsModuleService>(SEO_SITEMAPS_MODULE)
    .currentState()
  const now = Date.now()
  const settled = state?.dirty_since && now - new Date(state.dirty_since).getTime() >= SETTLE_MS
  const stale =
    !state?.generated_at || now - new Date(state.generated_at).getTime() >= FULL_EVERY_MS
  if (!settled && !stale) {
    return
  }
  try {
    await enqueueAsyncJobWorkflow(container).run({
      input: { type: "seo.sitemap", input: {}, requested_by: null },
    })
    logger.info({ event: "seo.sitemap_queued", reason: settled ? "changes" : "daily" })
  } catch (error) {
    if (!isConflictError(error)) {
      throw error
    }
  }
}

export const config = {
  name: "seo-sitemap-refresh",
  schedule: "*/5 * * * *",
}
