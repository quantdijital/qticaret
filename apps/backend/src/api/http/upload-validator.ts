import type { MedusaNextFunction, MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { isValidationError } from "../../lib/errors"
import { sanitizeImage } from "../../lib/media"
import { UPLOAD_MEDIA_TYPES, storedName, validateUpload } from "../../lib/security/upload"
import type { UploadFile } from "../../lib/security/upload"
import { rejectRequest } from "./reject"

/**
 * `POST /admin/uploads` (F2.9b): every file is checked by its bytes after
 * Medusa's multer has read it (route middlewares of ours run after the
 * core's); one refused file refuses the request, before anything is stored.
 * Accepted files get the name and MIME type of what their bytes are, which
 * is what storage serves them with, and images are stored cleaned (F3.3).
 */

// One admin action uploads a few product images; each file is stored apart
export const MAX_FILES_PER_UPLOAD = 20

type MulterFile = UploadFile & { mimetype?: string; size?: number }

// Medusa uses multer's `.array()`; `.single()`, `.fields()` and `.any()`
// shapes are read too, so a change upstream cannot slip files past the check
function uploadedFiles(req: MedusaRequest): MulterFile[] {
  const { file, files } = req as { file?: unknown; files?: unknown }
  const listed: unknown[] = Array.isArray(files)
    ? (files as unknown[])
    : files !== null && typeof files === "object"
      ? Object.values(files as Record<string, unknown>).flat()
      : []
  return [...listed, ...(file === undefined ? [] : [file])] as MulterFile[]
}

// Browsers send multipart file names as UTF-8 and multer reads them as
// latin1 ("Ürünler" arrives as "Ã\x9crÃ¼nler"); a name that decodes cleanly
// as UTF-8 was UTF-8
function multerName(name: string): string {
  const decoded = Buffer.from(name, "latin1").toString("utf8")
  return decoded.includes("\uFFFD") ? name : decoded
}

function refuse(req: MedusaRequest, res: MedusaResponse, reason: string) {
  rejectRequest(req, res, 400, { type: "invalid_data", message: reason }, reason)
}

export async function uploadValidator(
  req: MedusaRequest,
  res: MedusaResponse,
  next: MedusaNextFunction
) {
  const files = uploadedFiles(req)
  if (files.length > MAX_FILES_PER_UPLOAD) {
    refuse(req, res, "upload.too_many_files")
    return
  }
  const accepted = []
  for (const file of files) {
    try {
      accepted.push({ file, type: validateUpload(file) })
    } catch (error) {
      if (!isValidationError(error)) {
        throw error
      }
      refuse(req, res, error.safeMessage)
      return
    }
  }
  // Images are stored cleaned: upright, without EXIF/GPS and other metadata (F3.3)
  for (const { file, type } of accepted) {
    if (type.type === "csv") {
      continue
    }
    try {
      const clean = await sanitizeImage(file.buffer, type.type)
      file.buffer = clean.buffer
      file.size = clean.buffer.length
    } catch {
      // A header that passed the check over pixels the decoder cannot read
      refuse(req, res, "upload.unreadable_image")
      return
    }
  }
  for (const { file, type } of accepted) {
    file.originalname = storedName(multerName(file.originalname), type)
    file.mimetype = UPLOAD_MEDIA_TYPES[type.type].mime
  }
  next()
}
