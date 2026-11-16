import type { MedusaContainer } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import { errorSummary, logger } from "../../lib/logging"
import { readImage } from "../../lib/media"
import { MEDIA_MODULE } from "../../modules/media"
import type MediaModuleService from "../../modules/media/service"

export interface LogoSize {
  width: number
  height: number
}

// A side the storefront can draw: a whole number of pixels, at least one
const isSide = (value: unknown): value is number =>
  typeof value === "number" && Number.isInteger(value) && value > 0

const sizeOf = (width: unknown, height: unknown): LogoSize | null =>
  isSide(width) && isSide(height) ? { width, height } : null

/**
 * A brand logo's width and height in pixels, read on the server and never
 * taken from the request: the media library's record of the file (made
 * when it was uploaded, from the cleaned file), else the stored file's own
 * header. Null when neither says (no image, a file storage cannot give):
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
    const bytes = await container.resolve(Modules.FILE).getAsBuffer(fileId)
    const meta = await readImage(bytes).metadata()
    return sizeOf(meta.width, meta.height)
  } catch (error) {
    logger.warn({ event: "brands.logo_unmeasured", err: errorSummary(error) })
    return null
  }
}
