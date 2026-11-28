import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ASYNC_JOB_MODULE } from "../../../../../modules/async-job"
import type AsyncJobModuleService from "../../../../../modules/async-job/service"
import { enqueueAsyncJobWorkflow } from "../../../../../workflows/async-job/enqueue-async-job"
import { serializeJob } from "../../../async-jobs/serialize"

/**
 * `POST /admin/migrations/urls/rebuild` (adr/0042 Ek 2026-11-27): a
 * `migration.addresses` job ties every moved record's old address to its
 * new page again (301); the owner's decisions stay. Asks the owner to
 * prove themselves again: it writes the shop's redirects.
 */
export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  const { result } = await enqueueAsyncJobWorkflow(req.scope).run({
    input: {
      type: "migration.addresses",
      input: {},
      requested_by: req.auth_context.actor_id || null,
    },
  })
  const service = req.scope.resolve<AsyncJobModuleService>(ASYNC_JOB_MODULE)
  res.status(202).json({ async_job: serializeJob(await service.retrieveAsyncJob(result.id)) })
}
