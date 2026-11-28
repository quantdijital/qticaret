import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { sampleStatus } from "../../../../lib/sample-catalog/status"
import { loadSampleCatalogWorkflow } from "../../../../workflows/sample-catalog/load"
import type { AdminPostSampleCatalogLoadType } from "../validators"

/**
 * POST /admin/sample-catalog/load: the pack's sample catalogue into this
 * shop, every record marked as a sample; offered at once to a shop with
 * no products, loaded by hand on one that has some. Refused for a pack
 * with no samples, one the shop was not given, or one already loaded.
 */
export async function POST(
  req: AuthenticatedMedusaRequest<AdminPostSampleCatalogLoadType>,
  res: MedusaResponse
): Promise<void> {
  const { result } = await loadSampleCatalogWorkflow(req.scope).run({
    input: { pack: req.validatedBody.pack },
  })
  res.json({ result, sample_catalog: await sampleStatus(req.scope) })
}
