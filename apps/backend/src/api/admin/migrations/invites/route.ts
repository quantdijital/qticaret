import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ASYNC_JOB_MODULE } from "../../../../modules/async-job"
import type AsyncJobModuleService from "../../../../modules/async-job/service"
import { enqueueAsyncJobWorkflow } from "../../../../workflows/async-job/enqueue-async-job"
import { inviteStatus } from "../../../../workflows/migration/invites"
import { serializeJob } from "../../async-jobs/serialize"

/** `GET /admin/migrations/invites` (F14.5): how far the invitations have gone. */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  res.json({ invites: await inviteStatus(req.scope) })
}

/**
 * `POST /admin/migrations/invites`: every moved customer is asked, a share
 * a day, to open their account here. Asks the owner to prove themselves
 * again: it mails the shop's customers.
 */
export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  const { result } = await enqueueAsyncJobWorkflow(req.scope).run({
    input: {
      type: "migration.invites",
      input: {},
      requested_by: req.auth_context.actor_id || null,
    },
  })
  const service = req.scope.resolve<AsyncJobModuleService>(ASYNC_JOB_MODULE)
  res.status(202).json({ async_job: serializeJob(await service.retrieveAsyncJob(result.id)) })
}
