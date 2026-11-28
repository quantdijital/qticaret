import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { latestSampleLoad } from "../../../lib/sample-catalog/load-job"
import { sampleStatus } from "../../../lib/sample-catalog/status"

/**
 * GET /admin/sample-catalog (owner, 2026-11-28): the sample sets of the
 * packs this shop was given, whether the shop has products of its own,
 * what of the samples is here (each product, the categories, the
 * reviews), and the newest load job (queued, running with its percent,
 * succeeded with what it made, failed with its code), which the panel
 * polls while it runs. Owner and admin (the role table's `PRIVATE` list).
 */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  const [sampleCatalog, loadJob] = await Promise.all([
    sampleStatus(req.scope),
    latestSampleLoad(req.scope),
  ])
  res.json({ sample_catalog: sampleCatalog, load_job: loadJob })
}
