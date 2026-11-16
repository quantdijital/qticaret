import type { MedusaNextFunction, MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { isRetryableError, isValidationError } from "../../lib/errors"
import { errorSummary, logger } from "../../lib/logging"
import { sanitizeImage } from "../../lib/media"
import { sanitizeSvg } from "../../lib/media/svg"
import { UPLOAD_MEDIA_TYPES, storedName, validateLibraryUpload } from "../../lib/security/upload"
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

/** SVGs in one upload at most: each takes a cleaning worker (lib/media/svg.ts). */
export const MAX_SVGS_PER_UPLOAD = 3

/**
 * Express does not catch an async middleware's rejection (Medusa wraps its
 * route handlers, not these): anything unexpected is logged here and
 * passed on as a fixed error, so no rejection goes unhandled and no
 * module path or cause reaches the answer.
 */
export async function uploadValidator(
  req: MedusaRequest,
  res: MedusaResponse,
  next: MedusaNextFunction
) {
  let proceed: boolean
  try {
    proceed = await checkUploads(req, res)
  } catch (error) {
    logger.error({ event: "upload.check_failed", err: errorSummary(error) })
    next(new Error("upload check failed"))
    return
  }
  if (proceed) {
    next()
  }
}

/** Whether the request goes on: false when it was answered (a file refused). */
async function checkUploads(req: MedusaRequest, res: MedusaResponse): Promise<boolean> {
  const files = uploadedFiles(req)
  if (files.length > MAX_FILES_PER_UPLOAD) {
    refuse(req, res, "upload.too_many_files")
    return false
  }
  const accepted = []
  for (const file of files) {
    try {
      accepted.push({ file, type: validateLibraryUpload(file) })
    } catch (error) {
      if (!isValidationError(error)) {
        throw error
      }
      refuse(req, res, error.safeMessage)
      return false
    }
  }
  if (accepted.filter(({ type }) => type.type === "svg").length > MAX_SVGS_PER_UPLOAD) {
    refuse(req, res, "upload.svg_too_many")
    return false
  }
  // Images are stored cleaned: upright, without EXIF/GPS and other metadata (F3.3); an SVG
  // as its cleaner leaves it, never as sent (lib/media/svg.ts)
  for (const { file, type } of accepted) {
    if (type.type === "svg") {
      try {
        file.buffer = (await sanitizeSvg(file.buffer)).buffer
        file.size = file.buffer.length
      } catch (error) {
        if (isRetryableError(error)) {
          // Every cleaning slot taken and the queue full or too slow: try again shortly
          rejectRequest(
            req,
            res,
            503,
            { type: "temporarily_unavailable", message: error.safeMessage },
            error.safeMessage
          )
          return false
        }
        if (!isValidationError(error)) {
          throw error
        }
        refuse(req, res, error.safeMessage)
        return false
      }
      continue
    }
    try {
      const clean = await sanitizeImage(file.buffer, type.type)
      file.buffer = clean.buffer
      file.size = clean.buffer.length
    } catch (error) {
      // A header that passed the check over pixels the decoder cannot read
      logger.info({ event: "upload.image_unreadable", err: errorSummary(error) })
      refuse(req, res, "upload.unreadable_image")
      return false
    }
  }
  for (const { file, type } of accepted) {
    file.originalname = storedName(multerName(file.originalname), type)
    file.mimetype = UPLOAD_MEDIA_TYPES[type.type].mime
  }
  return true
}
