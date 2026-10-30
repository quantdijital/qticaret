import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError, Modules } from "@medusajs/framework/utils"
import { errorSummary, logger } from "../../../../../lib/logging"
import { ASYNC_JOB_MODULE } from "../../../../../modules/async-job"
import type AsyncJobModuleService from "../../../../../modules/async-job/service"
import { jobType } from "../../../../../workflows/async-job/types"
import { auditContext, auditService } from "../../../../http/audit/context"
import { rejectRequest } from "../../../../http/reject"
import { staffRoleOf } from "../../../../http/staff-guard"
import { publicInput } from "../../serialize"

/**
 * A short-lived link to the job's result file (adr/0014). A result with
 * personal data is the asker's (and the owner's) alone, and a sensitive
 * read: recorded first, refused (503) when the record cannot be written.
 * The link itself is never logged.
 */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  const service = req.scope.resolve<AsyncJobModuleService>(ASYNC_JOB_MODULE)
  const job = await service.retrieveAsyncJob(req.params["id"] ?? "")
  const expired = job.expires_at !== null && new Date(job.expires_at) < new Date()
  if (job.status !== "succeeded" || !job.result_file_id || expired) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "async_job.result_unavailable")
  }
  const personal = jobType(job.type)?.containsPersonalData ?? true
  // A file with personal data goes to whoever asked for it, or the owner (adr/0040)
  if (
    personal &&
    job.requested_by !== req.auth_context.actor_id &&
    (await staffRoleOf(req)) !== "owner"
  ) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "async_job.result_unavailable")
  }
  if (personal) {
    try {
      await auditService(req).record({
        kind: "sensitive_read",
        action: "GET /admin/async-jobs/:id/result",
        resource_type: "async_job",
        resource_id: job.id,
        // What was exported, never the link
        changes: { type: job.type, input: publicInput(job.input) },
        ...auditContext(req),
      })
    } catch (error) {
      logger.error({
        event: "audit.write_failed",
        action: "async_job.result",
        err: errorSummary(error),
      })
      rejectRequest(
        req,
        res,
        503,
        { type: "temporarily_unavailable", message: "errors.temporarily_unavailable" },
        "audit_unavailable"
      )
      return
    }
  }
  const file = await req.scope.resolve(Modules.FILE).retrieveFile(job.result_file_id)
  res.setHeader("Cache-Control", "no-store")
  res.json({ url: file.url })
}
