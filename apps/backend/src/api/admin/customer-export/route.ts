import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ASYNC_JOB_MODULE } from "../../../modules/async-job"
import type AsyncJobModuleService from "../../../modules/async-job/service"
import { enqueueAsyncJobWorkflow } from "../../../workflows/async-job/enqueue-async-job"
import { serializeJob } from "../async-jobs/serialize"
import type { AdminPostCustomerExportType } from "./validators"

/**
 * POST /admin/customer-export (CU2): the customer list as it is filtered,
 * as an Excel or CSV file made by a job (`customer.export`). The owner's
 * alone (permission-rules OWNER_ONLY): every customer's name and e-mail
 * leaves the shop with it. The request is audited as every write; the job
 * records what it read.
 */
export async function POST(
  req: AuthenticatedMedusaRequest<AdminPostCustomerExportType>,
  res: MedusaResponse
): Promise<void> {
  const { result } = await enqueueAsyncJobWorkflow(req.scope).run({
    input: {
      type: "customer.export",
      input: req.validatedBody,
      requested_by: req.auth_context.actor_id || null,
    },
  })
  const service = req.scope.resolve<AsyncJobModuleService>(ASYNC_JOB_MODULE)
  res.status(202).json({ async_job: serializeJob(await service.retrieveAsyncJob(result.id)) })
}
