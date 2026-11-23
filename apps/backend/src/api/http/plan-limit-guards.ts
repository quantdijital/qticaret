import type { MedusaNextFunction, MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { errorSummary, logger } from "../../lib/logging"
import { assertStorageFits } from "../../lib/plan-limits"
import { removeFiles } from "../../workflows/media/files"
import { registerMediaWorkflow } from "../../workflows/media/workflows"
import { platformErrorHandler } from "./error-handler"

interface UploadedFile {
  mimetype?: string
  size?: number
}

// Multer's shapes, as the upload check reads them (upload-validator.ts)
function uploadedFiles(req: MedusaRequest): UploadedFile[] {
  const { file, files } = req as { file?: unknown; files?: unknown }
  const listed: unknown[] = Array.isArray(files)
    ? (files as unknown[])
    : files !== null && typeof files === "object"
      ? Object.values(files as Record<string, unknown>).flat()
      : []
  return [...listed, ...(file === undefined ? [] : [file])] as UploadedFile[]
}

/**
 * The bytes an upload would add to the media library: its images (the
 * only uploads there are, review M4) as cleaned by the upload check.
 */
export const incomingImageBytes = (req: MedusaRequest): number =>
  uploadedFiles(req)
    .filter((file) => typeof file.mimetype === "string" && file.mimetype.startsWith("image/"))
    .reduce((sum, file) => sum + (typeof file.size === "number" ? file.size : 0), 0)

/**
 * `POST /admin/uploads` (adr/0061 Ek C14): images past the package's
 * storage limit, by the size they would add, are refused before anything
 * is stored (403 `plan.limit_reached`). Runs after the upload check, which
 * gives each file its cleaned size.
 */
export async function guardUploadStorage(
  req: MedusaRequest,
  _res: MedusaResponse,
  next: MedusaNextFunction
): Promise<void> {
  const bytes = incomingImageBytes(req)
  try {
    if (bytes > 0) {
      await assertStorageFits(req.scope, bytes)
    }
  } catch (error) {
    // The platform's error handler answers it (403 `plan.limit_reached`)
    next(error)
    return
  }
  next()
}

/**
 * `POST /admin/media/import`: an outside image's size is known only once
 * fetched, so a library already at the limit refuses it beforehand; the
 * fetched bytes are held to it again before they are stored (review L1).
 */
export async function guardImportStorage(
  req: MedusaRequest,
  _res: MedusaResponse,
  next: MedusaNextFunction
): Promise<void> {
  try {
    await assertStorageFits(req.scope, 0)
  } catch (error) {
    next(error)
    return
  }
  next()
}

/** The stored files Medusa's upload answers with. */
function storedIds(body: unknown): string[] {
  const files = (body as { files?: unknown } | null)?.files
  return Array.isArray(files)
    ? files.flatMap((file) => {
        const id = (file as { id?: unknown } | null)?.id
        return typeof id === "string" ? [id] : []
      })
    : []
}

/**
 * `POST /admin/uploads` (review H1): every image stored becomes a media
 * record at once, outside the library and attached to nothing. So it counts
 * against the package's storage from the moment it is stored, and the
 * nightly sweep (`jobs/media-sweep.ts`) removes it after a day if nothing
 * took it. `POST /admin/media` afterwards finds the record by its address.
 * The registration counts again with the new records in (`registerMediaStep`):
 * past the limit, the files just stored are removed and the answer is the
 * refusal. Medusa's handler answers through `res.json`, which waits for it.
 */
export function registerUploads(
  req: MedusaRequest,
  res: MedusaResponse,
  next: MedusaNextFunction
): void {
  const json = res.json.bind(res)
  res.json = (body: unknown) => {
    res.json = json
    const ids = storedIds(body)
    if (res.statusCode >= 400 || ids.length === 0) {
      return json(body)
    }
    const actor = (req as { auth_context?: { actor_type?: string; actor_id?: string } })
      .auth_context
    void registerMediaWorkflow(req.scope)
      .run({
        input: {
          file_ids: ids,
          library: false,
          uploaded_by: actor?.actor_type === "user" ? (actor.actor_id ?? null) : null,
        },
      })
      .then(
        () => {
          json(body)
        },
        async (error: unknown) => {
          logger.info({ event: "media.upload_not_registered", err: errorSummary(error) })
          await removeFiles(req.scope, ids)
          platformErrorHandler(error, req, res, next)
        }
      )
    return res
  }
  next()
}
