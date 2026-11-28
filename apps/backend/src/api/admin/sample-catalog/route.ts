import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { sampleStatus } from "../../../lib/sample-catalog/status"

/**
 * GET /admin/sample-catalog (owner, 2026-11-28): the sample sets of the
 * packs this shop was given, whether the shop has products of its own,
 * and what of the samples is here (each product, the categories, the
 * reviews). Owner and admin (the role table's `PRIVATE` list).
 */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  res.json({ sample_catalog: await sampleStatus(req.scope) })
}
