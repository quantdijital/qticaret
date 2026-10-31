import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { ConflictError } from "../../../../../lib/errors"
import { ASYNC_JOB_MODULE } from "../../../../../modules/async-job"
import type AsyncJobModuleService from "../../../../../modules/async-job/service"
import { staffRoleOf } from "../../../../http/staff-guard"
import { mayReach } from "../../access"
import { serializeJob } from "../../serialize"

/**
 * POST /admin/async-jobs/:id/cancel (S13, the F15 audit): a queued job
 * never starts; a running one stops at its next progress report, what it
 * did by then kept. Its asker or the owner; a finished job is 409.
 */
export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  const service = req.scope.resolve<AsyncJobModuleService>(ASYNC_JOB_MODULE)
  const job = await service.retrieveAsyncJob(req.params["id"] ?? "")
  if (!(await mayReach(req, job))) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "async_job.unknown")
  }
  const asker = job.requested_by === req.auth_context.actor_id
  if (!asker && (await staffRoleOf(req)) !== "owner") {
    throw new MedusaError(MedusaError.Types.NOT_ALLOWED, "async_job.not_yours")
  }
  if (!(await service.cancel(job.id))) {
    throw new ConflictError("async_job.not_open")
  }
  res.json({ async_job: serializeJob(await service.retrieveAsyncJob(job.id)) })
}
