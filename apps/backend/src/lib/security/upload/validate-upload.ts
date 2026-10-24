import { ValidationError } from "../../errors"
import { toSlug } from "../../seo"
import { readImageInfo } from "./image-header"
import type { ImageInfo, ImageType } from "./image-header"

/**
 * What an admin upload may be (docs/04, F2.9b): a JPEG, PNG, WebP or AVIF
 * image within size and pixel limits, judged by its bytes. SVG (which can
 * carry script), unknown types and files whose content does not match an
 * accepted type are refused. Re-encoding and EXIF removal follow in F3.3.
 */

export interface UploadLimits {
  maxBytes: number
  /** Width × height; a small file can declare a huge canvas (a decompression bomb). */
  maxPixels: number
  maxDimension: number
}

export const DEFAULT_UPLOAD_LIMITS: UploadLimits = {
  maxBytes: 10 * 1024 * 1024,
  maxPixels: 40_000_000,
  maxDimension: 10_000,
}

export interface UploadFile {
  buffer: Buffer
  originalname: string
}

export type AcceptedUpload = ImageInfo | { type: "csv" }

/** Extension and MIME type each accepted type is stored and served with. */
export const UPLOAD_MEDIA_TYPES: Record<ImageType | "csv", { extension: string; mime: string }> = {
  jpeg: { extension: "jpg", mime: "image/jpeg" },
  png: { extension: "png", mime: "image/png" },
  webp: { extension: "webp", mime: "image/webp" },
  avif: { extension: "avif", mime: "image/avif" },
  csv: { extension: "csv", mime: "text/csv" },
}

/**
 * The name a file is stored under: its own name as a slug, with the
 * extension of the type its bytes showed. Storage serves files by extension,
 * so a PNG header followed by HTML and named `logo.html` must not keep
 * `.html` (stored XSS on the backend origin).
 */
export function storedName(originalName: string, accepted: AcceptedUpload): string {
  const base = (originalName.split(/[\\/]/).pop() ?? "").replace(/\.[^.]*$/, "")
  return `${toSlug(base, 80) || "file"}.${UPLOAD_MEDIA_TYPES[accepted.type].extension}`
}

// Product import (Medusa's CSV) still goes through /admin/uploads with the
// local file provider; F3.9 replaces this with its own checked import path
const CSV_NAME = /\.csv$/i
const CSV_SAMPLE_BYTES = 8192

function isPlainCsv(file: UploadFile): boolean {
  if (!CSV_NAME.test(file.originalname)) {
    return false
  }
  const sample = file.buffer.subarray(0, CSV_SAMPLE_BYTES)
  if (sample.includes(0)) {
    return false
  }
  try {
    new TextDecoder("utf-8", { fatal: true }).decode(file.buffer)
    return true
  } catch {
    return false
  }
}

/** The accepted type, or a `ValidationError` with an `upload.*` key. */
export function validateUpload(
  file: UploadFile,
  limits: UploadLimits = DEFAULT_UPLOAD_LIMITS
): AcceptedUpload {
  if (file.buffer.length > limits.maxBytes) {
    throw new ValidationError("upload.too_large", { field: "files" })
  }
  const image = readImageInfo(file.buffer)
  if (image === null) {
    if (isPlainCsv(file)) {
      return { type: "csv" }
    }
    throw new ValidationError("upload.unsupported_type", { field: "files" })
  }
  if (
    image.width > limits.maxDimension ||
    image.height > limits.maxDimension ||
    image.width * image.height > limits.maxPixels
  ) {
    throw new ValidationError("upload.dimensions_too_large", { field: "files" })
  }
  return image
}
