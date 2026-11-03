import { randomUUID } from "node:crypto"
import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Modules } from "@medusajs/framework/utils"
import { ValidationError, isValidationError } from "../../../lib/errors"
import { ASYNC_JOB_MODULE } from "../../../modules/async-job"
import type AsyncJobModuleService from "../../../modules/async-job/service"
import { MIGRATION_MODULE } from "../../../modules/migration"
import type MigrationModuleService from "../../../modules/migration/service"
import { looksLikeWxr } from "../../../lib/migration/sources/wordpress/file"
import {
  MIGRATION_FILE_PREFIX,
  WORDPRESS_FILE_PREFIX,
} from "../../../workflows/async-job/types/migration-run"
import { startMigrationWorkflow } from "../../../workflows/migration/start"
import { readRawBody } from "../../http/raw-body"
import { rejectRequest } from "../../http/reject"
import { serializeJob } from "../async-jobs/serialize"
import type { AdminGetMigrationsType, AdminPostMigrationFileQueryType } from "./validators"

// 20,000 products and 200,000 customers fit, or a WordPress export; a larger shop moves in parts
export const MAX_BUNDLE_BYTES = 50 * 1024 * 1024
const PAGE = 20

/**
 * `POST /admin/migrations?mode=&source=` (F14, adr/0042 §9): a migration
 * file (the common records as JSON) or, with `source=wordpress`, a
 * WordPress export (WXR, adr/0042 Ek 2026-11-03), its bytes as the body. It is stored private and
 * a `migration.run` job checks or applies it; the job's report is
 * downloaded as any job's. The owner's alone; applying asks them to prove
 * themselves again.
 */
export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  const { mode, weight, length, width, height, source, category_base, refresh } =
    req.validatedQuery as AdminPostMigrationFileQueryType
  const parcel = [weight, length, width, height]
  if (parcel.some((value) => value !== undefined) && parcel.includes(undefined)) {
    throw new ValidationError("migration.parcel_incomplete")
  }
  const defaults =
    weight !== undefined && length !== undefined && width !== undefined && height !== undefined
      ? { weight, length, width, height }
      : null
  let buffer: Buffer
  try {
    buffer = await readRawBody(req, MAX_BUNDLE_BYTES)
  } catch (error) {
    if (isValidationError(error)) {
      rejectRequest(
        req,
        res,
        413,
        { type: "invalid_data", message: error.safeMessage },
        "migration_too_large"
      )
      return
    }
    throw error
  }
  // Read whole by the job; here only what it looks like: a JSON object, a WordPress export
  const wordpress = source === "wordpress"
  if (refresh && !wordpress) {
    throw new ValidationError("migration.refresh_wordpress_only")
  }
  if (
    wordpress
      ? !looksLikeWxr(buffer)
      : !buffer.subarray(0, 64).toString("utf8").trimStart().startsWith("{")
  ) {
    throw new ValidationError(
      wordpress ? "migration.wordpress_invalid" : "migration.bundle_invalid"
    )
  }
  const upload = await req.scope.resolve(Modules.FILE).getUploadStream({
    filename: wordpress
      ? `${WORDPRESS_FILE_PREFIX}${randomUUID()}.xml`
      : `${MIGRATION_FILE_PREFIX}${randomUUID()}.json`,
    mimeType: wordpress ? "application/xml" : "application/json",
    access: "private",
  })
  upload.writeStream.end(buffer)
  await upload.promise
  const { result } = await startMigrationWorkflow(req.scope).run({
    input: {
      source,
      source_file_id: upload.fileKey,
      category_base: wordpress ? (category_base ?? null) : null,
      ...(refresh ? { refresh: [refresh] } : {}),
      mode,
      defaults,
      requested_by: req.auth_context.actor_id || null,
    },
  })
  const service = req.scope.resolve<AsyncJobModuleService>(ASYNC_JOB_MODULE)
  res.status(202).json({ async_job: serializeJob(await service.retrieveAsyncJob(result.id)) })
}

/**
 * `GET /admin/migrations`: the runs, newest first, with what each came to;
 * a failed one with its code (`interrupted`: stopped half-way, it can be
 * started again).
 */
export async function GET(
  req: AuthenticatedMedusaRequest<unknown, AdminGetMigrationsType>,
  res: MedusaResponse
): Promise<void> {
  const { offset } = req.validatedQuery
  const [runs, count] = await req.scope
    .resolve<MigrationModuleService>(MIGRATION_MODULE)
    .listAndCountMigrationRuns(
      {},
      {
        skip: offset,
        take: PAGE,
        order: { created_at: "DESC" },
        select: [
          "id",
          "source",
          "mode",
          "status",
          "error_code",
          "job_id",
          "started_by",
          "counts",
          "created_at",
          "finished_at",
        ],
      }
    )
  res.json({ runs, count, offset, limit: PAGE })
}
