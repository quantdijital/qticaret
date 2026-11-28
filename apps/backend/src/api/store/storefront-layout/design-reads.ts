import type { MedusaStoreRequest } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { designPreview } from "../../../lib/content/preview-token"
import type { LayoutDocument } from "../../../lib/storefront/layout"
import { legacyTextAt } from "../../../lib/storefront/layout-pages-stored"
import { orderAccessKey } from "../../../lib/orders/access-token"
import { readable } from "../../../workflows/storefront/design-shared"
import { keptShopSettings } from "../../../workflows/storefront/design-steps"
import { layouts } from "../../../workflows/storefront/layout-row"
import { storeLayout } from "../../../workflows/storefront/layout-read"

/** A saved look as a preview shows it: the document and where its old pages keep their text. */
export interface OpenedDesign {
  document: LayoutDocument
  text_at: Record<string, number>
}

const unknown = () =>
  new MedusaError(MedusaError.Types.NOT_FOUND, "storefront_layout.preview_unknown")

/**
 * The saved look a signed look link opens (adr/0064, `designPreview`):
 * made for that look as it is saved now and before its end. As applying it
 * would make the draft (`design-apply.ts`): its sections and theme, the
 * draft's trust badges, swatches and "Az kaldı", no menu set (the shop's
 * live menus show). Anything else, a removed look, one today's schema no
 * longer reads, is a 404, as if there were no such page.
 */
export async function openedDesign(req: MedusaStoreRequest): Promise<OpenedDesign> {
  const parts = designPreview.parts(req.params["token"] ?? "")
  if (!parts) {
    throw unknown()
  }
  const [row] = await layouts(req.scope).listStorefrontDesigns(
    { id: parts.entryId },
    { select: ["id", "document", "updated_at"], take: 1 }
  )
  if (!row || !designPreview.opens(orderAccessKey(), parts, row.updated_at)) {
    throw unknown()
  }
  const stored = readable(row.document)
  if (!stored) {
    throw unknown()
  }
  const kept = await keptShopSettings(req.scope)
  return {
    document: { ...stored, settings: { ...stored.settings, ...kept, menus: null } },
    text_at: legacyTextAt(row.document),
  }
}

/** The look as the storefront would show it, through today's schema; the live menus stand. */
export async function designLayout(req: MedusaStoreRequest, design: OpenedDesign) {
  const layout = await storeLayout(
    req.scope,
    design.document,
    req.publishable_key_context.sales_channel_ids
  )
  return { ...layout, settings: { ...layout.settings, menus: null } }
}
