import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ASYNC_JOB_MODULE } from "../../../../../modules/async-job"
import type AsyncJobModuleService from "../../../../../modules/async-job/service"
import { enqueueAsyncJobWorkflow } from "../../../../../workflows/async-job/enqueue-async-job"
import { serializeJob } from "../../../async-jobs/serialize"

/**
 * `POST /admin/migrations/urls/apply` (F14.7): a `migration.urls` job keeps
 * moved records' old paths, writes the owner's 301s and 410s and reports
 * every address. Asks the owner to prove themselves again.
 */
export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  const { result } = await enqueueAsyncJobWorkflow(req.scope).run({
    input: { type: "migration.urls", input: {}, requested_by: req.auth_context.actor_id || null },
  })
  const service = req.scope.resolve<AsyncJobModuleService>(ASYNC_JOB_MODULE)
  res.status(202).json({ async_job: serializeJob(await service.retrieveAsyncJob(result.id)) })
}
