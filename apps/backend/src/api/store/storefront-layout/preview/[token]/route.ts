import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { layoutPreview } from "../../../../../lib/content/preview-token"
import type { LayoutDocument } from "../../../../../lib/storefront/layout"
import { orderAccessKey } from "../../../../../lib/orders/access-token"
import { layoutRow } from "../../../../../workflows/storefront/layout"
import { storeLayout } from "../../../../../workflows/storefront/layout-read"

/**
 * GET /store/storefront-layout/preview/:token (adr/0049): the draft as the
 * storefront would show it, for a signed link made for the draft as it is
 * saved now. Anything else is a 404, as if there were no such page.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  // A draft is no one's to keep, whatever the answer
  res.setHeader("Cache-Control", "private, no-store")
  const parts = layoutPreview.parts(req.params["token"] ?? "")
  const row = parts ? await layoutRow(req.scope) : null
  const updated = (row as unknown as { updated_at?: Date } | null)?.updated_at
  if (!parts || row?.id !== parts.entryId || !updated) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "storefront_layout.preview_unknown")
  }
  if (!layoutPreview.opens(orderAccessKey(), parts, updated)) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "storefront_layout.preview_unknown")
  }
  res.json({ layout: await storeLayout(req.scope, row.draft as LayoutDocument) })
}
