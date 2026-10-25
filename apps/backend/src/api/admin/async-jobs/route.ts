import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ASYNC_JOB_MODULE } from "../../../modules/async-job"
import type AsyncJobModuleService from "../../../modules/async-job/service"
import { enqueueAsyncJobWorkflow } from "../../../workflows/async-job/enqueue-async-job"
import { serializeJob } from "./serialize"
import type { AdminGetAsyncJobsType, AdminPostAsyncJobType } from "./validators"

/** Jobs, newest first (adr/0014). */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  const { limit, offset, ...filters } = req.validatedQuery as AdminGetAsyncJobsType
  const service = req.scope.resolve<AsyncJobModuleService>(ASYNC_JOB_MODULE)
  const [jobs, count] = await service.listAndCountAsyncJobs(filters, {
    order: { created_at: "DESC", id: "DESC" },
    skip: offset,
    take: limit,
  })
  res.json({ async_jobs: jobs.map(serializeJob), count, offset, limit })
}

/** Queues a job; the worker runs it and the list shows its progress. */
export async function POST(
  req: AuthenticatedMedusaRequest<AdminPostAsyncJobType>,
  res: MedusaResponse
): Promise<void> {
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
