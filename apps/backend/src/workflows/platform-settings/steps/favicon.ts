import type { MedusaContainer } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import { StepResponse, createStep } from "@medusajs/framework/workflows-sdk"
import sharp from "sharp"
import { ValidationError } from "../../../lib/errors"
import { errorSummary, logger } from "../../../lib/logging"
import { MAX_INPUT_PIXELS } from "../../../lib/media"
import { SVG_MIME, looksLikeSvg } from "../../../lib/media/svg"
import { MEDIA_MODULE } from "../../../modules/media"
import type MediaModuleService from "../../../modules/media/service"
import { storePublicFile } from "../../media/files"
import type { SaveSettingsSectionInput } from "./save-settings-section"

/**
 * The site icon's limits (the store profile's favicon): a PNG, which every
 * browser and Apple's home screen take, or an SVG (the owner, 2026-11-16:
 * "faviconda da svg olsun"), cleaned at upload (`lib/media/svg.ts`) and
 * smaller. The library holds no ICO: uploads refuse it (no cleaning path).
 */
export const FAVICON_MIME = "image/png"
export const FAVICON_MAX_BYTES = 1024 * 1024
export const FAVICON_SVG_MAX_BYTES = 100 * 1024
/** Apple's home screen icon takes no SVG: a PNG this size is made from the cleaned one. */
export const APPLE_TOUCH_SIDE = 180

export interface FaviconAsset {
  mime_type: string | null
  size: number | null
}

/** Why the image cannot be the site icon, or null. Squareness and size are the panel's warnings. */
export function faviconProblem(asset: FaviconAsset): string | null {
  if (asset.mime_type !== FAVICON_MIME && asset.mime_type !== SVG_MIME) {
    return "platform_settings.favicon_type"
  }
  // A record that never measured its file (an older one) proves no limit: upload it again
  if (asset.size === null) {
    return "platform_settings.favicon_unknown"
  }
  const limit = asset.mime_type === SVG_MIME ? FAVICON_SVG_MAX_BYTES : FAVICON_MAX_BYTES
  if (asset.size > limit) {
    return "platform_settings.favicon_too_large"
  }
  return null
}

/** What an SVG icon's record keeps of its home screen PNG (beside any versions it has). */
export interface AppleTouch {
  url: string
  width: number
  height: number
}

export const appleTouchOf = (derivatives: unknown): AppleTouch | null => {
  const touch = (derivatives as { apple_touch?: unknown } | null)?.apple_touch as
    Partial<AppleTouch> | undefined
  return typeof touch?.url === "string"
    ? { url: touch.url, width: APPLE_TOUCH_SIDE, height: APPLE_TOUCH_SIDE }
    : null
}

/**
 * The home screen PNG of an SVG icon, from its stored (cleaned) file only:
 * drawn near 512 px whatever size it names (no huge canvas), within the
 * pixel limit, on white (Apple fills a transparent icon with black).
 */
export async function appleTouchPng(svg: Buffer): Promise<Buffer> {
  const meta = await sharp(svg, { limitInputPixels: MAX_INPUT_PIXELS }).metadata()
  const side = Math.max(meta.width, meta.height, 1)
  const density = Math.min(2400, Math.max(1, Math.round((72 * 512) / side)))
  return sharp(svg, { density, limitInputPixels: MAX_INPUT_PIXELS })
    .resize(APPLE_TOUCH_SIDE, APPLE_TOUCH_SIDE, {
      fit: "contain",
      background: { r: 255, g: 255, b: 255, alpha: 1 },
    })
    .flatten({ background: "#ffffff" })
    .png()
    .toBuffer()
}

interface IconAsset {
  id: string
  file_id: string | null
  derivatives: unknown
  derivative_file_ids: string[] | null
}

/**
 * Makes the SVG icon's home screen PNG once and keeps it on its record
 * (removed with it). One that cannot be made is logged: the storefront
 * then names no Apple icon, as before there was a site icon.
 */
async function ensureAppleTouch(
  container: Pick<MedusaContainer, "resolve">,
  asset: IconAsset
): Promise<void> {
  if (appleTouchOf(asset.derivatives) || !asset.file_id) {
    return
  }
  try {
    const bytes = await container.resolve(Modules.FILE).getAsBuffer(asset.file_id)
    if (!looksLikeSvg(bytes)) {
      return
    }
    const png = await appleTouchPng(bytes)
    const file = await storePublicFile(
      container as MedusaContainer,
      `apple-touch-${asset.id}.png`,
      "image/png",
      png
    )
    const derivatives = (asset.derivatives ?? {}) as Record<string, unknown>
    await container.resolve<MediaModuleService>(MEDIA_MODULE).updateMediaAssets({
      id: asset.id,
      derivatives: {
        ...derivatives,
        apple_touch: { url: file.url, width: APPLE_TOUCH_SIDE, height: APPLE_TOUCH_SIDE },
      },
      derivative_file_ids: [...(asset.derivative_file_ids ?? []), file.id],
    })
  } catch (error) {
    logger.warn({
      event: "favicon.apple_touch_failed",
      assetId: asset.id,
      err: errorSummary(error),
    })
  }
}

/**
 * The site icon (appearance `favicon_url`), when one is sent: one of the
 * shop's uploads, a PNG or a cleaned SVG within its size limit; an SVG
 * gets its home screen PNG. Returns the record to mark kept, like the
 * share image.
 */
export const faviconMediaStep = createStep(
  "platform-settings-favicon",
  async (input: SaveSettingsSectionInput, { container }) => {
    const url =
      input.section === "appearance"
        ? (input.values as { favicon_url?: unknown }).favicon_url
        : undefined
    if (typeof url !== "string" || url === "") {
      return new StepResponse<string[]>([])
    }
    const [asset] = await container.resolve<MediaModuleService>(MEDIA_MODULE).listMediaAssets(
      { url, file_id: { $ne: null } },
      {
        select: ["id", "file_id", "mime_type", "size", "derivatives", "derivative_file_ids"],
        take: 1,
      }
    )
    if (!asset) {
      throw new ValidationError("platform_settings.favicon_unknown", { field: "favicon_url" })
    }
    const problem = faviconProblem(asset)
    if (problem) {
      throw new ValidationError(problem, { field: "favicon_url" })
    }
    if (asset.mime_type === SVG_MIME) {
      await ensureAppleTouch(container, asset)
    }
    return new StepResponse([asset.id])
  }
)
