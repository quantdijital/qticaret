import type { Readable } from "node:stream"
import type { MedusaContainer } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import { errorSummary, logger } from "../../lib/logging"
import { readImage } from "../../lib/media"
import { DEFAULT_UPLOAD_LIMITS } from "../../lib/security/upload"
import { MEDIA_MODULE } from "../../modules/media"
import type MediaModuleService from "../../modules/media/service"

export interface LogoSize {
  width: number
  height: number
}

/**
 * The longest side kept (PNG's and WebP's own limits are near it; AVIF's
 * and JPEG's below it). The storefront reads no longer side either
 * (`brandLogoSize` in `@qticaret/types`): keep the two the same.
 */
export const LOGO_SIDE_MAX = 65_535

// A side the storefront can draw: a whole number of pixels, at least one, at most the longest kept
const isSide = (value: unknown): value is number =>
  typeof value === "number" && Number.isInteger(value) && value > 0 && value <= LOGO_SIDE_MAX

const sizeOf = (width: unknown, height: unknown): LogoSize | null =>
  isSide(width) && isSide(height) ? { width, height } : null

/**
 * A stored file's bytes, read no further than an upload may be (the
 * upload check's own limit): null for a longer one, which is never held
 * whole. A logo need not be a library record, so its key may name any
 * stored file, and storage gives no size before it is read.
 */
async function readWithinUploadLimit(stream: Readable): Promise<Buffer | null> {
  const max = DEFAULT_UPLOAD_LIMITS.maxBytes
  const chunks: Buffer[] = []
  let total = 0
  try {
    for await (const chunk of stream) {
      const part = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as Uint8Array)
      total += part.length
      if (total > max) {
        return null
      }
      chunks.push(part)
    }
  } finally {
    stream.destroy()
  }
  return Buffer.concat(chunks, total)
}

/**
 * A brand logo's width and height in pixels, read on the server and never
 * taken from the request: the media library's record of the file (made
 * when it was uploaded, from the cleaned file), else the stored file's own
 * header, read only up to the upload limit. Null when neither says (no
 * image, a file larger than an upload may be, one storage cannot give):
 * the storefront then draws the logo as before, without a size.
 */
export async function measureLogo(
  container: Pick<MedusaContainer, "resolve">,
  fileId: string,
  url: string
): Promise<LogoSize | null> {
  const [asset] = await container
    .resolve<MediaModuleService>(MEDIA_MODULE)
    .listMediaAssets({ url }, { select: ["file_id", "width", "height"], take: 1 })
  const recorded = asset?.file_id === fileId ? sizeOf(asset.width, asset.height) : null
  if (recorded) {
    return recorded
  }
  try {
    const stream = await container.resolve(Modules.FILE).getDownloadStream(fileId)
    const bytes = await readWithinUploadLimit(stream)
    if (!bytes) {
      logger.warn({ event: "brands.logo_unmeasured", reason: "too_large" })
      return null
    }
    const meta = await readImage(bytes).metadata()
    return sizeOf(meta.width, meta.height)
  } catch (error) {
    logger.warn({ event: "brands.logo_unmeasured", err: errorSummary(error) })
    return null
  }
}
