import type { MedusaResponse, MedusaStoreRequest } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { layoutPreview } from "../../../../../lib/content/preview-token"
import { readStoredLayout } from "../../../../../lib/storefront/layout"
import { orderAccessKey } from "../../../../../lib/orders/access-token"
import { layoutRow } from "../../../../../workflows/storefront/layout"
import { storeLayout } from "../../../../../workflows/storefront/layout-read"
import { draftMenus } from "../../../../../workflows/storefront/menus-read"

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
  // Through today's schema: a draft saved before a group existed shows it empty
  const channels = req.publishable_key_context.sales_channel_ids
  const draft = readStoredLayout(row.draft)
  const [layout, menus] = await Promise.all([
    storeLayout(req.scope, draft, channels),
    draft.settings.menus ? draftMenus(req.scope, draft.settings.menus) : null,
  ])
  res.json({ layout: { ...layout, settings: { ...layout.settings, menus } } })
}
