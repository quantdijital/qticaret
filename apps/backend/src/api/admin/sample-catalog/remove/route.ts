import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ConflictError } from "../../../../lib/errors"
import { latestSampleLoad } from "../../../../lib/sample-catalog/load-job"
import { planRemoval } from "../../../../lib/sample-catalog/plan"
import { readSampleRows } from "../../../../lib/sample-catalog/read"
import { sampleStatus } from "../../../../lib/sample-catalog/status"
import { removeSampleCatalogWorkflow } from "../../../../workflows/sample-catalog/remove"
import type { AdminPostSampleCatalogRemoveType } from "../validators"

/**
 * POST /admin/sample-catalog/remove ("Örnek içeriği kaldır"): the chosen
 * parts of what the sample catalogue made, never a record of the shop's
 * own. `dry_run` answers the plan (what would go, what stays and why)
 * without writing: the panel's confirmation shows it before the owner agrees.
 */
export async function POST(
  req: AuthenticatedMedusaRequest<AdminPostSampleCatalogRemoveType>,
  res: MedusaResponse
): Promise<void> {
  const { parts, keep_product_ids, dry_run } = req.validatedBody
  const loading = await latestSampleLoad(req.scope)
  if (loading && (loading.status === "queued" || loading.status === "running")) {
    // The load writes the records this would read: one after the other
    throw new ConflictError("sample_catalog.loading")
  }
  const choice = { parts, keep_product_ids }
  if (dry_run) {
    const plan = planRemoval(await readSampleRows(req.scope), choice)
    res.json({
      plan: {
        products: plan.product_ids.length,
        categories: plan.category_ids.length,
        reviews: plan.review_ids.length,
        categories_hidden: plan.hide_category_ids.length,
        blocked: plan.blocked,
        categories_kept: plan.categories_kept,
      },
    })
    return
  }
  const { result } = await removeSampleCatalogWorkflow(req.scope).run({ input: choice })
  res.json({ result, sample_catalog: await sampleStatus(req.scope) })
}
