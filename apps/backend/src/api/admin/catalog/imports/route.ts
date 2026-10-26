import { randomUUID } from "node:crypto"
import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Modules } from "@medusajs/framework/utils"
import { ValidationError, isValidationError } from "../../../../lib/errors"
import { XLSX_MIME, sheetFormatOf } from "../../../../lib/sheets"
import { ASYNC_JOB_MODULE } from "../../../../modules/async-job"
import type AsyncJobModuleService from "../../../../modules/async-job/service"
import { IMPORT_FILE_PREFIX } from "../../../../workflows/async-job/types/catalog-import"
import { startCatalogImportWorkflow } from "../../../../workflows/catalog/import/start-import"
import { readRawBody } from "../../../http/raw-body"
import { rejectRequest } from "../../../http/reject"
import { serializeJob } from "../../async-jobs/serialize"
import type { AdminPostCatalogImportQueryType } from "./validators"

// 5,000 rows of 60 columns is a few MB, as xlsx or CSV
export const MAX_SHEET_BYTES = 10 * 1024 * 1024

/**
 * `POST /admin/catalog/imports?mode=` (F3.9, adr/0018): a product sheet,
 * its bytes as the body. What the bytes are (xlsx or CSV) decides, not
 * its name or type; it is stored private, and a `catalog.import` job
 * checks or applies it. The job's report is downloaded as any job's.
 */
export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  const { mode } = req.validatedQuery as AdminPostCatalogImportQueryType
  let buffer: Buffer
  try {
    buffer = await readRawBody(req, MAX_SHEET_BYTES)
  } catch (error) {
    if (isValidationError(error)) {
      rejectRequest(
        req,
        res,
        413,
        { type: "invalid_data", message: error.safeMessage },
        "sheet_too_large"
      )
      return
    }
    throw error
  }
  const format = sheetFormatOf(buffer)
  if (!format) {
    throw new ValidationError("upload.sheet_invalid")
  }
  const upload = await req.scope.resolve(Modules.FILE).getUploadStream({
    filename: `${IMPORT_FILE_PREFIX}${randomUUID()}.${format}`,
    mimeType: format === "xlsx" ? XLSX_MIME : "text/csv",
    access: "private",
  })
  upload.writeStream.end(buffer)
  await upload.promise
  const { result } = await startCatalogImportWorkflow(req.scope).run({
    input: {
      source_file_id: upload.fileKey,
      mode,
      requested_by: req.auth_context.actor_id || null,
    },
  })
  const service = req.scope.resolve<AsyncJobModuleService>(ASYNC_JOB_MODULE)
  res.status(202).json({ async_job: serializeJob(await service.retrieveAsyncJob(result.id)) })
}
