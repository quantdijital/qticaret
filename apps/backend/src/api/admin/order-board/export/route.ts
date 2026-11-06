import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ASYNC_JOB_MODULE } from "../../../../modules/async-job"
import type AsyncJobModuleService from "../../../../modules/async-job/service"
import { enqueueAsyncJobWorkflow } from "../../../../workflows/async-job/enqueue-async-job"
import { serializeJob } from "../../async-jobs/serialize"
import type { AdminPostOrderExportType } from "./validators"

/**
 * POST /admin/order-board/export: the order list as it is filtered, as an
 * Excel or CSV file made by a job (`order.export`). The owner's alone
 * (permission-rules OWNER_ONLY): a file of every customer's name, address
 * and phone leaves the shop with it. The request is audited as every
 * write; the job records what it read.
 */
export async function POST(
  req: AuthenticatedMedusaRequest<AdminPostOrderExportType>,
  res: MedusaResponse
): Promise<void> {
  const { result } = await enqueueAsyncJobWorkflow(req.scope).run({
    input: {
      type: "order.export",
      input: req.validatedBody,
      requested_by: req.auth_context.actor_id || null,
    },
  })
  const service = req.scope.resolve<AsyncJobModuleService>(ASYNC_JOB_MODULE)
  res.status(202).json({ async_job: serializeJob(await service.retrieveAsyncJob(result.id)) })
}
