import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ASYNC_JOB_MODULE } from "../../../../modules/async-job"
import type AsyncJobModuleService from "../../../../modules/async-job/service"
import { startMigrationWorkflow } from "../../../../workflows/migration/start"
import { serializeJob } from "../../async-jobs/serialize"
import type { AdminPostFeedMigrationType } from "../validators"

/**
 * `POST /admin/migrations/feed` (F14.3, adr/0042 §10): the old site's
 * Google Merchant feed (every Turkish platform publishes one) checked or
 * moved here by a `migration.run` job: products and their variants,
 * categories, brands, pictures and old addresses. Applying asks the owner
 * to prove themselves again.
 */
export async function POST(
  req: AuthenticatedMedusaRequest<AdminPostFeedMigrationType>,
  res: MedusaResponse
): Promise<void> {
  const { mode, defaults, url, kinds } = req.validatedBody
  const { result } = await startMigrationWorkflow(req.scope).run({
    input: {
      source: "feed",
      source_file_id: null,
      feed_url: url,
      ...(kinds?.length ? { kinds } : {}),
      mode,
      defaults,
      requested_by: req.auth_context.actor_id || null,
    },
  })
  const service = req.scope.resolve<AsyncJobModuleService>(ASYNC_JOB_MODULE)
  res.status(202).json({ async_job: serializeJob(await service.retrieveAsyncJob(result.id)) })
}
