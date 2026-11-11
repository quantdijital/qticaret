import { ValidationError, isValidationError } from "../errors"
import { UPLOAD_MEDIA_TYPES, storedName, validateUpload } from "../security/upload"
import { sanitizeImage } from "./sanitize"

export interface PreparedImage {
  buffer: Buffer
  /** The name it is stored under: its own as a slug, the extension of what its bytes are. */
  filename: string
  mimeType: string
  width: number
  height: number
}

/**
 * Bytes from outside (an address the shop gave) as an image the library
 * keeps: checked exactly as an upload is (docs/04, F2.9b: a JPEG, PNG, WebP
 * or AVIF by its bytes, within the size and pixel limits; SVG and anything
 * else refused) and cleaned as one is (F3.3: upright, no EXIF/GPS). A
 * refusal is a `ValidationError` under `field`.
 */
export async function prepareImage(
  bytes: Buffer,
  name: string,
  field: string
): Promise<PreparedImage> {
  let type
  try {
    type = validateUpload({ buffer: bytes, originalname: name })
  } catch (error) {
    if (isValidationError(error)) {
      throw new ValidationError(error.safeMessage, { field })
    }
    throw error
  }
  let clean
  try {
    clean = await sanitizeImage(bytes, type.type)
  } catch {
    throw new ValidationError("upload.unreadable_image", { field })
  }
  return {
    buffer: clean.buffer,
    filename: storedName(name, type),
    mimeType: UPLOAD_MEDIA_TYPES[type.type].mime,
    width: clean.width,
    height: clean.height,
  }
}
