import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { PREVIEW_PATH, designPreview } from "../../../../../lib/content/preview-token"
import { orderAccessKey } from "../../../../../lib/orders/access-token"
import { brandOf } from "../../../../../workflows/messaging/brand"
import { layouts } from "../../../../../workflows/storefront/layout-row"
import { designIdOf } from "../../validators"

/**
 * GET /admin/storefront-designs/:id/preview (adr/0064): a link that draws
 * this saved look on the storefront, its sections and theme, for an hour
 * and until it is renamed or removed: the gallery frames it as the card's
 * picture and opens it in a new tab. Writes nothing, so a read (no audit
 * entry at every gallery visit), never kept; the link opens that
 * look only, never the draft or another look.
 */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  res.setHeader("Cache-Control", "private, no-store")
  const id = designIdOf(req.params)
  const [row] = await layouts(req.scope).listStorefrontDesigns(
    { id },
    { select: ["id", "updated_at"], take: 1 }
  )
  if (!row) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "storefront_design.unknown")
  }
  const { token, expires_at } = designPreview.token(orderAccessKey(), {
    id: row.id,
    updated_at: row.updated_at,
  })
  const { storefrontUrl } = await brandOf(req.scope)
  const path = `${PREVIEW_PATH}/${token}`
  res.json({ url: storefrontUrl ? `${storefrontUrl}${path}` : path, path, expires_at })
}
