import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ASYNC_JOB_MODULE } from "../../../../../modules/async-job"
import type AsyncJobModuleService from "../../../../../modules/async-job/service"
import { restartMigrationWorkflow } from "../../../../../workflows/migration/restart"
import { serializeJob } from "../../../async-jobs/serialize"

/**
 * `POST /admin/migrations/:id/restart` (F14, adr/0042 §9): a run that
 * stopped half-way (`interrupted`) started again as it was asked, from
 * its stored file; refused for any other run, and when the file is gone
 * (`migration.source_file_gone`: upload it again). The owner's alone;
 * restarting an apply asks them to prove themselves again.
 */
export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  const { result } = await restartMigrationWorkflow(req.scope).run({
    input: {
      run_id: (req.params as Record<string, string | undefined>)["id"] ?? "",
      requested_by: req.auth_context.actor_id || null,
    },
  })
  const service = req.scope.resolve<AsyncJobModuleService>(ASYNC_JOB_MODULE)
  res.status(202).json({ async_job: serializeJob(await service.retrieveAsyncJob(result.id)) })
}
