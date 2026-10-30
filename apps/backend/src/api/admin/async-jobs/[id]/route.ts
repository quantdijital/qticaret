import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { ASYNC_JOB_MODULE } from "../../../../modules/async-job"
import type AsyncJobModuleService from "../../../../modules/async-job/service"
import { jobType } from "../../../../workflows/async-job/types"
import { staffRoleOf } from "../../../http/staff-guard"
import { serializeJob } from "../serialize"

/** One job; an audit log export only to the one who asked for it and the owner. */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  const service = req.scope.resolve<AsyncJobModuleService>(ASYNC_JOB_MODULE)
  const job = await service.retrieveAsyncJob(req.params["id"] ?? "")
  if (
    jobType(job.type)?.privateToAsker &&
    job.requested_by !== req.auth_context.actor_id &&
    (await staffRoleOf(req)) !== "owner"
  ) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "async_job.unknown")
  }
  res.json({ async_job: serializeJob(job) })
}
