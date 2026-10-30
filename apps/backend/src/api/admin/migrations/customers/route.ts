import { randomUUID } from "node:crypto"
import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Modules } from "@medusajs/framework/utils"
import { ValidationError, isValidationError } from "../../../../lib/errors"
import { XLSX_MIME, sheetFormatOf } from "../../../../lib/sheets"
import { ASYNC_JOB_MODULE } from "../../../../modules/async-job"
import type AsyncJobModuleService from "../../../../modules/async-job/service"
import { CUSTOMER_FILE_PREFIX } from "../../../../workflows/async-job/types/migration-run"
import { startMigrationWorkflow } from "../../../../workflows/migration/start"
import { readRawBody } from "../../../http/raw-body"
import { rejectRequest } from "../../../http/reject"
import { serializeJob } from "../../async-jobs/serialize"
import type { AdminPostMigrationQueryType } from "../validators"

// Two hundred thousand customers with an address each, as CSV
export const MAX_CUSTOMER_SHEET_BYTES = 20 * 1024 * 1024

/**
 * `POST /admin/migrations/customers?mode=` (F14.3, adr/0042 §5): the old
 * platform's customer list (xlsx or CSV, its own export), its bytes as
 * the body. Stored private; a `migration.run` job checks or applies it
 * and deletes it. Applying asks the owner to prove themselves again.
 */
export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  const { mode } = req.validatedQuery as AdminPostMigrationQueryType
  let buffer: Buffer
  try {
    buffer = await readRawBody(req, MAX_CUSTOMER_SHEET_BYTES)
  } catch (error) {
    if (isValidationError(error)) {
      rejectRequest(
        req,
        res,
        413,
        { type: "invalid_data", message: error.safeMessage },
        "customers_too_large"
      )
      return
    }
    throw error
  }
  const format = sheetFormatOf(buffer)
  if (!format) {
    throw new ValidationError("migration.customers_sheet_invalid")
  }
  const upload = await req.scope.resolve(Modules.FILE).getUploadStream({
    filename: `${CUSTOMER_FILE_PREFIX}${randomUUID()}.${format}`,
    mimeType: format === "xlsx" ? XLSX_MIME : "text/csv",
    access: "private",
  })
  upload.writeStream.end(buffer)
  await upload.promise
  const { result } = await startMigrationWorkflow(req.scope).run({
    input: {
      source: "customers",
      source_file_id: upload.fileKey,
      mode,
      defaults: null,
      requested_by: req.auth_context.actor_id || null,
    },
  })
  const service = req.scope.resolve<AsyncJobModuleService>(ASYNC_JOB_MODULE)
  res.status(202).json({ async_job: serializeJob(await service.retrieveAsyncJob(result.id)) })
}
