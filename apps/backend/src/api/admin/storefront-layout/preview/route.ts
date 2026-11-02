import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { PREVIEW_PATH, layoutPreview } from "../../../../lib/content/preview-token"
import { orderAccessKey } from "../../../../lib/orders/access-token"
import { ValidationError } from "../../../../lib/errors"
import { brandOf } from "../../../../workflows/messaging/brand"
import { layoutRow } from "../../../../workflows/storefront/layout"

/**
 * POST /admin/storefront-layout/preview (adr/0049): a link that shows the
 * draft on the storefront for a day and until it is saved again: the theme
 * editor frames it, staff may share it. The draft must have been saved once.
 */
export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  const row = await layoutRow(req.scope)
  if (!row) {
    throw new ValidationError("storefront_layout.nothing_to_preview", { field: "document" })
  }
  const { token, expires_at } = layoutPreview.token(orderAccessKey(), {
    id: row.id,
    updated_at: (row as unknown as { updated_at: Date }).updated_at,
  })
  const { storefrontUrl } = await brandOf(req.scope)
  const path = `${PREVIEW_PATH}/${token}`
  res.json({ url: storefrontUrl ? `${storefrontUrl}${path}` : path, path, expires_at })
}
