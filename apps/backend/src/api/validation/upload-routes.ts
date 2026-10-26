import type { MedusaNextFunction, MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ASYNC_JOB_MODULE } from "../../modules/async-job"
import type AsyncJobModuleService from "../../modules/async-job/service"
import { IMPORT_FILE_PREFIX } from "../../workflows/async-job/types/catalog-import"
import { answerAsMissing } from "../http/require-feature"

/**
 * Medusa's `GET`/`DELETE /admin/uploads/:id` serve any stored file. A job's
 * result can hold personal data and is served only by
 * `/admin/async-jobs/:id/result`, with its actor check and read record
 * (adr/0014); here such a file does not exist.
 */
export async function hideJobResultFiles(
  req: MedusaRequest,
  res: MedusaResponse,
  next: MedusaNextFunction
) {
  const id = (req.params as Record<string, string | undefined>)["id"] ?? ""
  // An uploaded product sheet is its import job's to read (F3.9)
  if (id.includes(IMPORT_FILE_PREFIX)) {
    answerAsMissing(req, res, "job_result_file")
    return
  }
  try {
    const jobs = await req.scope
      .resolve<AsyncJobModuleService>(ASYNC_JOB_MODULE)
      .listAsyncJobs({ result_file_id: id }, { select: ["id"], take: 1 })
    if (jobs.length > 0) {
      answerAsMissing(req, res, "job_result_file")
      return
    }
  } catch (error) {
    next(error)
    return
  }
  next()
}

/**
 * Direct uploads through presigned URLs skip every upload check (F2.9b:
 * bytes, renaming, size). Closed until F3.9 builds its checked import path.
 */
export function closePresignedUploads(req: MedusaRequest, res: MedusaResponse) {
  answerAsMissing(req, res, "presigned_uploads_closed")
}
