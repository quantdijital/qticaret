import type { MedusaContainer } from "@medusajs/framework/types"
import { coreWebVitalsFinding, searchConsoleFinding } from "../../../lib/seo/insights"
import type { AuditFinding } from "../../../lib/seo/audit"
import { SEO_INSIGHTS_MODULE } from "../../../modules/seo-insights"
import type SeoInsightsModuleService from "../../../modules/seo-insights/service"
import { sitemapPaths } from "../insights"

const DAY = 24 * 60 * 60 * 1000
/** Figures older than this say nothing of the shop now: a connection removed leaves no finding. */
const FRESH_DAYS = 7
/** An inspection is trusted this long. */
const INSPECTION_DAYS = 60

/**
 * S-GSC-01 and S-CWV-01 (F10.11) from what the nightly insights job last
 * brought, when it is fresh: Search Console's pages and inspections of the
 * pages still in the sitemap, CrUX's field data.
 */
export async function insightFindings(
  container: MedusaContainer,
  now: Date
): Promise<(AuditFinding | null)[]> {
  const insights = container.resolve<SeoInsightsModuleService>(SEO_INSIGHTS_MODULE)
  const runs = await insights.listInsightRuns({})
  const fresh = (kind: string) =>
    runs.some(
      (run) =>
        run.kind === kind &&
        run.error === null &&
        new Date(run.ran_at).getTime() > now.getTime() - FRESH_DAYS * DAY
    )
  const inspections = await insights.indexStates(
    await sitemapPaths(container),
    new Date(now.getTime() - INSPECTION_DAYS * DAY)
  )
  return [
    searchConsoleFinding({
      pages: fresh("search") ? await insights.pageStats() : [],
      inspections,
    }),
    fresh("crux") ? coreWebVitalsFinding(await insights.fieldStates()) : null,
  ]
}
