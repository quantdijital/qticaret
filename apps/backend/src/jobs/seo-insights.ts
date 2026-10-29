import type { MedusaContainer } from "@medusajs/framework/types"
import { logger } from "../lib/logging"
import { collectSeoInsightsWorkflow } from "../workflows/seo/insights"

/**
 * What Search Console and CrUX say of the shop, every night (F10.11):
 * before the SEO audit reads it, and after both have the day's figures.
 */
export default async function seoInsights(container: MedusaContainer) {
  const { result } = await collectSeoInsightsWorkflow(container).run({
    input: { now: new Date().toISOString() },
  })
  logger.info({ event: "seo_insights.collected", ...result.search, crux: result.field.ran })
}

export const config = {
  name: "seo-insights",
  // 02:30 UTC (05:30 in Türkiye)
  schedule: "30 2 * * *",
}
