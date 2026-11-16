import type { MedusaContainer } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import { StepResponse, createStep } from "@medusajs/framework/workflows-sdk"
import sharp from "sharp"
import { ValidationError } from "../../../lib/errors"
import { errorSummary, logger } from "../../../lib/logging"
import { SVG_MIME, looksLikeSvg } from "../../../lib/media/svg"
import {
  APPLE_TOUCH_SIDE,
  MAIL_LOGO_BOX,
  appleTouchPng,
  mailLogoPng,
} from "../../../lib/media/svg-raster"
import { MEDIA_MODULE } from "../../../modules/media"
import type MediaModuleService from "../../../modules/media/service"
import { PLATFORM_SETTINGS_MODULE } from "../../../modules/platform-settings"
import type PlatformSettingsModuleService from "../../../modules/platform-settings/service"
import { storePublicFile } from "../../media/files"
import type { SaveSettingsSectionInput } from "./save-settings-section"

/**
 * The shop's brand pictures (appearance): the two logos and the site icon.
 * Each newly chosen one must be one of the shop's own uploads, so what is
 * stored is what the upload check cleaned (an SVG among them, the owner,
 * 2026-11-16). A value saved again as it is stays (one kept from before
 * this rule, an outside address included). The site icon is a PNG (at
 * most 1 MB) or an SVG (at most 100 KB); the library holds no ICO.
 */
export const FAVICON_MIME = "image/png"
export const FAVICON_MAX_BYTES = 1024 * 1024
export const FAVICON_SVG_MAX_BYTES = 100 * 1024
export { APPLE_TOUCH_SIDE }

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

/** A PNG made of an SVG and kept on its record (beside any versions it has). */
interface Drawn {
  url: string
  width: number
  height: number
}

const drawnOf = (derivatives: unknown, key: "apple_touch" | "mail_png"): Drawn | null => {
  const drawn = (derivatives as Record<string, unknown> | null)?.[key] as Partial<Drawn> | undefined
  return typeof drawn?.url === "string"
    ? { url: drawn.url, width: drawn.width ?? 0, height: drawn.height ?? 0 }
    : null
}

/** An SVG site icon's home screen PNG, or none. */
export const appleTouchOf = (derivatives: unknown): Drawn | null =>
  drawnOf(derivatives, "apple_touch")

/** An SVG logo's PNG for mail clients, or none. */
export const mailPngOf = (derivatives: unknown): Drawn | null => drawnOf(derivatives, "mail_png")

interface BrandAsset {
  id: string
  file_id: string | null
  mime_type: string | null
  size: number | null
  derivatives: unknown
  derivative_file_ids: string[] | null
}

const DRAWS = {
  apple_touch: { draw: appleTouchPng, name: "apple-touch", box: APPLE_TOUCH_SIDE },
  mail_png: { draw: mailLogoPng, name: "mail-logo", box: MAIL_LOGO_BOX.width },
} as const

/**
 * Makes an SVG's PNG once, from its stored (cleaned) file, and keeps it on
 * its record (removed with it). One that cannot be made is logged: the
 * storefront then names no Apple icon, a mail shows the shop's name.
 */
async function ensureDrawn(
  container: Pick<MedusaContainer, "resolve">,
  asset: BrandAsset,
  key: keyof typeof DRAWS
): Promise<void> {
  if (drawnOf(asset.derivatives, key) || !asset.file_id) {
    return
  }
  try {
    const bytes = await container.resolve(Modules.FILE).getAsBuffer(asset.file_id)
    if (!looksLikeSvg(bytes)) {
      return
    }
    const { draw, name } = DRAWS[key]
    const png = await draw(bytes)
    const meta = await sharp(png).metadata()
    const file = await storePublicFile(
      container as MedusaContainer,
      `${name}-${asset.id}.png`,
      "image/png",
      png
    )
    const derivatives = (asset.derivatives ?? {}) as Record<string, unknown>
    const kept = { url: file.url, width: meta.width, height: meta.height }
    await container.resolve<MediaModuleService>(MEDIA_MODULE).updateMediaAssets({
      id: asset.id,
      derivatives: { ...derivatives, [key]: kept },
      derivative_file_ids: [...(asset.derivative_file_ids ?? []), file.id],
    })
    asset.derivatives = { ...derivatives, [key]: kept }
  } catch (error) {
    logger.warn({ event: "brand.svg_png_failed", key, assetId: asset.id, err: errorSummary(error) })
  }
}

const FIELDS = ["logo_light_url", "logo_dark_url", "favicon_url"] as const
type Field = (typeof FIELDS)[number]

const UNKNOWN: Record<Field, string> = {
  logo_light_url: "platform_settings.logo_unknown",
  logo_dark_url: "platform_settings.logo_unknown",
  favicon_url: "platform_settings.favicon_unknown",
}

/**
 * The appearance section's brand pictures, when sent: each new one one of
 * the shop's uploads (the icon within its limits); an SVG icon gets its
 * home screen PNG, an SVG light logo its PNG for mails. Returns the
 * records to mark kept, like the share image.
 */
export const brandImagesStep = createStep(
  "platform-settings-brand-images",
  async (input: SaveSettingsSectionInput, { container }) => {
    if (input.section !== "appearance") {
      return new StepResponse<string[]>([])
    }
    const values = input.values as Partial<Record<Field, unknown>>
    const sent = FIELDS.filter((field) => typeof values[field] === "string" && values[field] !== "")
    if (sent.length === 0) {
      return new StepResponse<string[]>([])
    }
    const saved = (await container
      .resolve<PlatformSettingsModuleService>(PLATFORM_SETTINGS_MODULE)
      .getSection("appearance")) as Partial<Record<Field, string | null>>
    const media = container.resolve<MediaModuleService>(MEDIA_MODULE)
    const kept: string[] = []
    for (const field of sent) {
      const url = values[field] as string
      // Saved again as it is: kept, whatever it was chosen as
      if (saved[field] === url) {
        continue
      }
      const [asset] = (await media.listMediaAssets(
        { url, file_id: { $ne: null } },
        {
          select: ["id", "file_id", "mime_type", "size", "derivatives", "derivative_file_ids"],
          take: 1,
        }
      )) as BrandAsset[]
      if (!asset) {
        throw new ValidationError(UNKNOWN[field], { field })
      }
      if (field === "favicon_url") {
        const problem = faviconProblem(asset)
        if (problem) {
          throw new ValidationError(problem, { field })
        }
      }
      if (asset.mime_type === SVG_MIME) {
        if (field === "favicon_url") {
          await ensureDrawn(container, asset, "apple_touch")
        } else if (field === "logo_light_url") {
          await ensureDrawn(container, asset, "mail_png")
        }
      }
      kept.push(asset.id)
    }
    return new StepResponse(kept)
  }
)
