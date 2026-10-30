import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ASYNC_JOB_MODULE } from "../../../../../modules/async-job"
import type AsyncJobModuleService from "../../../../../modules/async-job/service"
import { enqueueAsyncJobWorkflow } from "../../../../../workflows/async-job/enqueue-async-job"
import { serializeJob } from "../../../async-jobs/serialize"
import type { AdminPostMigrationSitemapType } from "../../validators"

/** `POST /admin/migrations/urls/sitemap` (F14.7): a `migration.sitemap` job reads the old site's sitemap. */
export async function POST(
  req: AuthenticatedMedusaRequest<AdminPostMigrationSitemapType>,
  res: MedusaResponse
): Promise<void> {
  const { result } = await enqueueAsyncJobWorkflow(req.scope).run({
    input: {
      type: "migration.sitemap",
      input: { url: req.validatedBody.url },
      requested_by: req.auth_context.actor_id || null,
    },
  })
  const service = req.scope.resolve<AsyncJobModuleService>(ASYNC_JOB_MODULE)
  res.status(202).json({ async_job: serializeJob(await service.retrieveAsyncJob(result.id)) })
}
