import type { MedusaResponse, MedusaStoreRequest } from "@medusajs/framework/http"
import { previewRow } from "../../../../access"
import { draftPageLayout, namedPage } from "../../../../page-reads"

/**
 * GET /store/storefront-layout/preview/:token/pages/:id (adr/0073 §6): a
 * live content page's layout in the draft, for the signed design link
 * (adr/0049). A link may be passed on, so a page not live answers `null`:
 * a draft page never leaves through it (the editor's live session shows
 * one). Anything else is a 404, as the design link's own read.
 */
export async function GET(req: MedusaStoreRequest, res: MedusaResponse): Promise<void> {
  // A draft is no one's to keep, whatever the answer
  res.setHeader("Cache-Control", "private, no-store")
  const row = await previewRow(req)
  const page = await namedPage(req)
  res.json({ page: page.live ? await draftPageLayout(req, row, page.id) : null })
}
