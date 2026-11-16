import { StepResponse, createStep } from "@medusajs/framework/workflows-sdk"
import { ValidationError } from "../../../lib/errors"
import { MEDIA_MODULE } from "../../../modules/media"
import type MediaModuleService from "../../../modules/media/service"
import type { SaveSettingsSectionInput } from "./save-settings-section"

/**
 * The site icon's limits (the store profile's favicon): a PNG, which every
 * browser and Apple's home screen icon take. The library holds no ICO or
 * SVG: uploads refuse both (docs/04, F2.9b: SVG can carry script; ICO has
 * no cleaning path), so neither is offered here.
 */
export const FAVICON_MIME = "image/png"
export const FAVICON_MAX_BYTES = 1024 * 1024

export interface FaviconAsset {
  mime_type: string | null
  size: number | null
}

/** Why the image cannot be the site icon, or null. Squareness and size are the panel's warnings. */
export function faviconProblem(asset: FaviconAsset): string | null {
  if (asset.mime_type !== FAVICON_MIME) {
    return "platform_settings.favicon_type"
  }
  // A record that never measured its file (an older one) proves no limit: upload it again
  if (asset.size === null) {
    return "platform_settings.favicon_unknown"
  }
  if (asset.size > FAVICON_MAX_BYTES) {
    return "platform_settings.favicon_too_large"
  }
  return null
}

/**
 * The site icon (appearance `favicon_url`), when one is sent: one of the
 * shop's uploads, a PNG within the size limit. Returns the record to mark
 * kept, like the share image; reads only.
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
    const [asset] = await container
      .resolve<MediaModuleService>(MEDIA_MODULE)
      .listMediaAssets(
        { url, file_id: { $ne: null } },
        { select: ["id", "mime_type", "size"], take: 1 }
      )
    if (!asset) {
      throw new ValidationError("platform_settings.favicon_unknown", { field: "favicon_url" })
    }
    const problem = faviconProblem(asset)
    if (problem) {
      throw new ValidationError(problem, { field: "favicon_url" })
    }
    return new StepResponse([asset.id])
  }
)
