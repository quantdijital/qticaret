import type { MedusaResponse, MedusaStoreRequest } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { layoutPreview } from "../../../../../lib/content/preview-token"
import { orderAccessKey } from "../../../../../lib/orders/access-token"
import { layoutRow } from "../../../../../workflows/storefront/layout"
import { draftLayout } from "../../draft"

/**
 * GET /store/storefront-layout/preview/:token (adr/0049): the draft as the
 * storefront would show it, for a signed link made for the draft as it is
 * saved now. Anything else is a 404, as if there were no such page. The
 * draft's theme comes in its settings; a menu set it carries (adr/0063 §3)
 * comes printed as the live menus are, for the storefront to show instead.
 */
export async function GET(req: MedusaStoreRequest, res: MedusaResponse): Promise<void> {
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
  res.json({ layout: await draftLayout(req, row) })
}
