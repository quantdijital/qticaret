import type { MedusaNextFunction, MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { assertStorageFits, forgetUsage } from "../../lib/plan-limits"

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
 * The bytes an upload would add to the media library: its images, as
 * cleaned and named by the upload check that ran before (a sheet to import
 * is not stored in the library and does not count).
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
      forgetUsage("storage_mb")
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
 * fetched, so a library already at the limit refuses it beforehand.
 */
export async function guardImportStorage(
  req: MedusaRequest,
  _res: MedusaResponse,
  next: MedusaNextFunction
): Promise<void> {
  try {
    await assertStorageFits(req.scope, 0)
    forgetUsage("storage_mb")
  } catch (error) {
    next(error)
    return
  }
  next()
}
