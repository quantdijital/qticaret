import type { MedusaResponse, MedusaStoreRequest } from "@medusajs/framework/http"
import { storeContentEntry } from "../../../../../content/read"
import { sessionRow } from "../../../../access"
import { draftPageLayout, namedPage } from "../../../../page-reads"

/**
 * GET /store/storefront-layout/session/:token/pages/:id (adr/0073 §5, §6):
 * a content page, in draft or live, with its layout in the draft as last
 * saved, for the theme editor's live preview: the shop designs a new page
 * before it goes live. The page comes as `GET /store/content/:id` gives a
 * live one. Opens only as the session's own read does (adr/0065 §1); a
 * page that is not one is a 404. Never kept by anyone.
 */
export async function GET(req: MedusaStoreRequest, res: MedusaResponse): Promise<void> {
  res.setHeader("Cache-Control", "private, no-store")
  const { row, edition } = await sessionRow(req)
  const page = await namedPage(req)
  const [layout, entry] = await Promise.all([
    draftPageLayout(req, row, page.id),
    storeContentEntry(req.scope, page.id, { draft: true }),
  ])
  res.json({ page: layout, entry, edition })
}
