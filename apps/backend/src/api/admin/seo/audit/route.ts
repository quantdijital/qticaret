import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { hasReport, latestAudit } from "./latest"

/**
 * GET /admin/seo/audit (docs/14 §3.9): the store-wide audit as the SEO page
 * shows it, whoever started it (the night or staff). `latest` is the last
 * run asked for, whatever its state; `report` the last that finished, its
 * findings, and whether its file can still be downloaded
 * (`/admin/seo/audit/report`). The night's runs are not in the jobs list
 * (docs/06 principle 10), so the page reads them here.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const [latest, report] = await Promise.all([
    latestAudit(req.scope),
    latestAudit(req.scope, "succeeded"),
  ])
  const summary = report?.result_summary as { findings?: unknown[] } | null | undefined
  res.json({
    audit: {
      latest: latest
        ? {
            id: latest.id,
            status: latest.status,
            progress: latest.progress,
            created_at: latest.created_at,
            finished_at: latest.finished_at,
          }
        : null,
      report: report
        ? {
            id: report.id,
            created_at: report.created_at,
            finished_at: report.finished_at,
            findings: summary?.findings ?? [],
            has_file: hasReport(report),
          }
        : null,
    },
  })
}
