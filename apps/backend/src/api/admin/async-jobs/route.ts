import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ASYNC_JOB_MODULE } from "../../../modules/async-job"
import type AsyncJobModuleService from "../../../modules/async-job/service"
import { ValidationError } from "../../../lib/errors"
import { enqueueAsyncJobWorkflow } from "../../../workflows/async-job/enqueue-async-job"
import {
  OWNER_JOB_TYPES,
  PLATFORM_JOB_TYPES,
  PRIVATE_JOB_TYPES,
  jobType,
} from "../../../workflows/async-job/types"
import { staffRoleOf } from "../../http/staff-guard"
import { serializeJob } from "./serialize"
import type { AdminGetAsyncJobsType, AdminPostAsyncJobType } from "./validators"

/**
 * Jobs, newest first (adr/0014); an audit log export shows only to the one
 * who asked for it and the owner, a migration's only to an owner. The
 * platform's own (the address data sync) shows to no one in the shop
 * (docs/06 principle 10): the list and its count leave them out.
 */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  const { limit, offset, ...filters } = req.validatedQuery as AdminGetAsyncJobsType
  const service = req.scope.resolve<AsyncJobModuleService>(ASYNC_JOB_MODULE)
  const shops = { type: { $nin: PLATFORM_JOB_TYPES } }
  const seen =
    (await staffRoleOf(req)) === "owner"
      ? [shops]
      : [
          shops,
          { type: { $nin: OWNER_JOB_TYPES } },
          {
            $or: [
              { type: { $nin: PRIVATE_JOB_TYPES } },
              { requested_by: req.auth_context.actor_id || "-" },
            ],
          },
        ]
  const [jobs, count] = await service.listAndCountAsyncJobs(
    { ...filters, $and: seen },
    {
      order: { created_at: "DESC", id: "DESC" },
      skip: offset,
      take: limit,
    }
  )
  res.json({ async_jobs: jobs.map(serializeJob), count, offset, limit })
}

/**
 * Queues a job; the worker runs it and the list shows its progress.
 * Internal types have their own routes; the platform's, its schedule.
 */
export async function POST(
  req: AuthenticatedMedusaRequest<AdminPostAsyncJobType>,
  res: MedusaResponse
): Promise<void> {
  const type = jobType(req.validatedBody.type)
  if (type?.internal || type?.platform) {
    throw new ValidationError("async_job.type_unknown", { field: "type" })
  }
  const { result } = await enqueueAsyncJobWorkflow(req.scope).run({
    input: {
      type: req.validatedBody.type,
      input: req.validatedBody.input ?? {},
      requested_by: req.auth_context.actor_id || null,
    },
  })
  const service = req.scope.resolve<AsyncJobModuleService>(ASYNC_JOB_MODULE)
  res.status(202).json({ async_job: serializeJob(await service.retrieveAsyncJob(result.id)) })
}
