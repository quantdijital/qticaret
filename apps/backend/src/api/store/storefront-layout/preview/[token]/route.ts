import type { MedusaResponse, MedusaStoreRequest } from "@medusajs/framework/http"
import { draftLayout } from "../../draft"
import { previewRow } from "../../access"

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
  const row = await previewRow(req)
  res.json({ layout: await draftLayout(req, row) })
}
