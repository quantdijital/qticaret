import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError, Modules } from "@medusajs/framework/utils"
import { hasReport, latestAudit } from "../latest"

/**
 * GET /admin/seo/audit/report (docs/14 §3.9): a short-lived link to the
 * last finished audit's CSV, the night's or one staff started. Paths and
 * page names only, no personal data: no read record, unlike a job file
 * with personal data. The link itself is never logged.
 */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  const job = await latestAudit(req.scope, "succeeded")
  if (!job?.result_file_id || !hasReport(job)) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "async_job.result_unavailable")
  }
  const file = await req.scope.resolve(Modules.FILE).retrieveFile(job.result_file_id)
  res.setHeader("Cache-Control", "no-store")
  res.json({ url: file.url })
}
