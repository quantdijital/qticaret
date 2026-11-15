import type { MedusaStoreRequest } from "@medusajs/framework/http"
import { readStoredLayout } from "../../../lib/storefront/layout"
import type { layoutRow } from "../../../workflows/storefront/layout"
import { storeLayout } from "../../../workflows/storefront/layout-read"
import { draftMenus } from "../../../workflows/storefront/menus-read"

type Row = NonNullable<Awaited<ReturnType<typeof layoutRow>>>

/**
 * The draft as the storefront would show it (adr/0049, adr/0065): through
 * today's schema (a draft saved before a group existed shows it empty),
 * its theme in its settings, a menu set it carries (adr/0063 §3) printed
 * as the live menus are, for the storefront to show instead. Shared by the
 * signed design link and the editor's live session.
 */
export async function draftLayout(req: MedusaStoreRequest, row: Row) {
  const channels = req.publishable_key_context.sales_channel_ids
  const draft = readStoredLayout(row.draft)
  const [layout, menus] = await Promise.all([
    storeLayout(req.scope, draft, channels),
    draft.settings.menus ? draftMenus(req.scope, draft.settings.menus) : null,
  ])
  return { ...layout, settings: { ...layout.settings, menus } }
}
