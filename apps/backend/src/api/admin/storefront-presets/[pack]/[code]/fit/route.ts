import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { presetFit } from "../../../fit"
import { presetPath } from "../../../validators"

/**
 * GET /admin/storefront-presets/:pack/:code/fit (owner's decision
 * 2026-11-28): the sections applying this look whole would leave out in
 * this shop (another sector's rails bound to categories it lacks), for the
 * apply window to list before anything is written. Reads only.
 */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  const path = presetPath.safeParse(req.params)
  const unfit = path.success ? await presetFit(req.scope, path.data.pack, path.data.code) : null
  if (!unfit) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "storefront_preset.unknown")
  }
  res.json({ unfit })
}
