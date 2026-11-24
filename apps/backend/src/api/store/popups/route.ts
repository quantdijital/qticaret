import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { storePopups } from "../../../workflows/popups/store-read"

/**
 * `GET /store/popups` (adr/0080 §5): the pop-ups live now, highest
 * priority first, with what the storefront needs to choose one for a page
 * view and draw it. Read after the page has loaded, never in its critical
 * path; the same for every visitor, so cached like the storefront's frame.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const popups = await storePopups(req.scope)
  res.setHeader("Cache-Control", "public, max-age=60, stale-while-revalidate=300")
  res.vary("x-publishable-api-key")
  res.json({ popups })
}
