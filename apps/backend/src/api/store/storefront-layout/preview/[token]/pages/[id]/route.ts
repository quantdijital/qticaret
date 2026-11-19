import type { MedusaResponse, MedusaStoreRequest } from "@medusajs/framework/http"
import { previewRow } from "../../../../access"
import { draftPageLayout, livePageId } from "../../../../page-reads"

/**
 * GET /store/storefront-layout/preview/:token/pages/:id (adr/0073 §6): a
 * live content page's layout in the draft, for the signed design link
 * (adr/0049). A link may be passed on, so every page not live (a draft, a
 * deleted one, a post, none such) answers `null` alike: a draft page never
 * leaves through it (the editor's live session shows one). A link that
 * does not open is a 404, as the design link's own read.
 */
export async function GET(req: MedusaStoreRequest, res: MedusaResponse): Promise<void> {
  // A draft is no one's to keep, whatever the answer
  res.setHeader("Cache-Control", "private, no-store")
  const row = await previewRow(req)
  const id = await livePageId(req)
  res.json({ page: id ? await draftPageLayout(req, row, id) : null })
}
