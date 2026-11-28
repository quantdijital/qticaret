import type { MedusaResponse, MedusaStoreRequest } from "@medusajs/framework/http"
import { storePageLayout } from "../../../../../../../workflows/storefront/layout-page-read"
import { openedDesign } from "../../../../design-reads"
import { livePageId } from "../../../../page-reads"

/**
 * GET /store/storefront-layout/design/:token/pages/:id (adr/0064, adr/0073
 * §6): a live content page's layout in a saved look, for its signed look
 * link. As the design link's: every page not live answers `null` alike, a
 * link that does not open is a 404.
 */
export async function GET(req: MedusaStoreRequest, res: MedusaResponse): Promise<void> {
  // A saved look is no one's to keep, whatever the answer
  res.setHeader("Cache-Control", "private, no-store")
  const design = await openedDesign(req)
  const id = await livePageId(req)
  res.json({
    page: id
      ? await storePageLayout(req.scope, design, id, req.publishable_key_context.sales_channel_ids)
      : null,
  })
}
