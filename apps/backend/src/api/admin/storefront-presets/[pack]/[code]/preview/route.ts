import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { presetPreview } from "../../../preview"
import { presetPath } from "../../../validators"

/**
 * GET /admin/storefront-presets/:pack/:code/preview (adr/0063 §7): a
 * ready-made look's `preview.webp` for the gallery, served through the
 * panel's session (the packs are not public files). Only a look the gallery
 * lists; anything else, or a look with no picture, is not found. Sent as
 * an image that is never read as anything else.
 */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  const path = presetPath.safeParse(req.params)
  const image = path.success ? await presetPreview(req.scope, path.data.pack, path.data.code) : null
  if (!image) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "storefront_preset.unknown")
  }
  res.setHeader("Content-Type", "image/webp")
  res.setHeader("X-Content-Type-Options", "nosniff")
  res.setHeader("Content-Security-Policy", "default-src 'none'")
  res.setHeader("Cache-Control", "private, max-age=300")
  res.send(image)
}
