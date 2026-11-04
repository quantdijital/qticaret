import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ASYNC_JOB_MODULE } from "../../../../modules/async-job"
import type AsyncJobModuleService from "../../../../modules/async-job/service"
import { enqueueAsyncJobWorkflow } from "../../../../workflows/async-job/enqueue-async-job"
import { TR_ADDRESS_SYNC_JOB } from "../../../../workflows/async-job/types/tr-address-sync"
import { serializeJob } from "../../async-jobs/serialize"
import type { AdminPostTrAddressSyncType } from "../validators"

/**
 * `POST /admin/tr-address/sync` (adr/0008 Ek 2026-11-04): the owner brings
 * the address data up to TürkiyeAPI's dataset now. Queues the job (one at
 * a time: a second request while one runs is a 409) and answers 202 with
 * it; the job's progress and report are read from `/admin/async-jobs/:id`
 * or `/admin/tr-address/status`.
 */
export async function POST(
  req: AuthenticatedMedusaRequest<AdminPostTrAddressSyncType>,
  res: MedusaResponse
): Promise<void> {
  const { result } = await enqueueAsyncJobWorkflow(req.scope).run({
    input: {
      type: TR_ADDRESS_SYNC_JOB,
      input: { only_if_changed: false },
      requested_by: req.auth_context.actor_id || null,
    },
  })
  const jobs = req.scope.resolve<AsyncJobModuleService>(ASYNC_JOB_MODULE)
  res.status(202).json({ async_job: serializeJob(await jobs.retrieveAsyncJob(result.id)) })
}
