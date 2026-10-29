import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { SEO_INSIGHTS_MODULE } from "../../../../modules/seo-insights"
import type SeoInsightsModuleService from "../../../../modules/seo-insights/service"

const TOP = 5

/**
 * GET /admin/seo/insights (F10.11): the shop's last 28 days in Google
 * Search beside the 28 before, the pages that lost the most clicks, how
 * many inspected pages are in the index, its Core Web Vitals, and when
 * each part last ran.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const insights = req.scope.resolve<SeoInsightsModuleService>(SEO_INSIGHTS_MODULE)
  const [pages, inspections, fields, runs] = await Promise.all([
    insights.listSearchPageStats({}, { take: 10_000 }),
    insights.listUrlInspections({}, { select: ["verdict"], take: 10_000 }),
    insights.listFieldMetrics({}),
    insights.listInsightRuns({}),
  ])
  const sum = (pick: (row: (typeof pages)[number]) => number) =>
    pages.reduce((total, row) => total + pick(row), 0)
  const clicks = sum((row) => row.clicks)
  const impressions = sum((row) => row.impressions)
  res.json({
    insights: {
      search: pages.length
        ? {
            period_end: pages[0]?.period_end ?? null,
            clicks,
            impressions,
            ctr: impressions > 0 ? clicks / impressions : 0,
            position:
              impressions > 0
                ? sum((row) => (row.position_x100 / 100) * row.impressions) / impressions
                : 0,
            prev_clicks: sum((row) => row.prev_clicks),
            prev_impressions: sum((row) => row.prev_impressions),
            dropped: pages
              .filter((row) => row.prev_clicks > row.clicks)
              .sort((a, b) => b.prev_clicks - b.clicks - (a.prev_clicks - a.clicks))
              .slice(0, TOP)
              .map((row) => ({ path: row.path, clicks: row.clicks, prev_clicks: row.prev_clicks })),
          }
        : null,
      index: {
        inspected: inspections.length,
        indexed: inspections.filter((row) => row.verdict === "PASS").length,
      },
      vitals: fields.map((row) => ({
        form_factor: row.form_factor,
        has_data: row.has_data,
        lcp_ms: row.lcp_ms,
        inp_ms: row.inp_ms,
        cls: row.cls_x1000 === null ? null : row.cls_x1000 / 1000,
        collected_at: row.collected_at,
      })),
      runs: runs.map((run) => ({ kind: run.kind, ran_at: run.ran_at, error: run.error })),
    },
  })
}
