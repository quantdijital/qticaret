import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { planSampleLoad } from "../../../../lib/sample-catalog/load-plan"
import { latestSampleLoad } from "../../../../lib/sample-catalog/load-job"
import { enqueueAsyncJobWorkflow } from "../../../../workflows/async-job/enqueue-async-job"
import { SAMPLE_LOAD_JOB } from "../../../../workflows/async-job/types/sample-catalog-load"
import type { AdminPostSampleCatalogLoadType } from "../validators"

/**
 * POST /admin/sample-catalog/load: the pack's sample catalogue into this
 * shop, every record marked as a sample; offered at once to a shop with
 * no products, loaded by hand on one that has some. A whole set takes
 * minutes, so it runs as a background job (`sample_catalog.load`): checked
 * here first (a pack with no samples, one the shop was not given, one
 * already loaded are refused at once), queued, answered 202 with the job;
 * `GET /admin/sample-catalog` tells how far it is. One at a time (409
 * `async_job.already_running`).
 */
export async function POST(
  req: AuthenticatedMedusaRequest<AdminPostSampleCatalogLoadType>,
  res: MedusaResponse
): Promise<void> {
  const { pack } = req.validatedBody
  await planSampleLoad(req.scope, pack)
  await enqueueAsyncJobWorkflow(req.scope).run({
    input: {
      type: SAMPLE_LOAD_JOB,
      input: { pack },
      requested_by: req.auth_context.actor_id || null,
    },
  })
  res.status(202).json({ load_job: await latestSampleLoad(req.scope) })
}
