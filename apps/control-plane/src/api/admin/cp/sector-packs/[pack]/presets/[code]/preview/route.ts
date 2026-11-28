import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { presetPreview } from "../../../../../../../../lib/tenants/preset-preview"

/**
 * GET /admin/cp/sector-packs/:pack/presets/:code/preview (every staff
 * role, as the packs): a ready-made look's picture for the new-shop
 * wizard's "Görünüm" step (adr/0063 task 2.7). Release data, no personal
 * data; sent as an image that is never read as anything else.
 */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  const { pack, code } = req.params as { pack?: string; code?: string }
  const image = pack && code ? await presetPreview(pack, code) : null
  if (!image) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "cp.preset_unknown")
  }
  res.setHeader("Content-Type", "image/webp")
  res.setHeader("X-Content-Type-Options", "nosniff")
  res.setHeader("Content-Security-Policy", "default-src 'none'")
  res.setHeader("Cross-Origin-Resource-Policy", "same-origin")
  res.setHeader("Cache-Control", "private, max-age=300")
  res.send(image)
}
