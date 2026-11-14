import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { presetGallery } from "./read"

/**
 * GET /admin/storefront-presets (adr/0063 §7): the ready-made looks of the
 * packs applied to this shop and of `general`, each with whether it is the
 * one the draft and the live design were last given.
 */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  res.json({ presets: await presetGallery(req.scope) })
}
