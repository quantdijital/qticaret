import type { MedusaResponse, MedusaStoreRequest } from "@medusajs/framework/http"
import { designLayout, openedDesign } from "../../design-reads"

/**
 * GET /store/storefront-layout/design/:token (adr/0064): a saved look as
 * the storefront would show it, for a signed look link the gallery made
 * (its card's picture, "Önizle"). Anything else is a 404, as if there were
 * no such page; the storefront then shows what is live.
 */
export async function GET(req: MedusaStoreRequest, res: MedusaResponse): Promise<void> {
  // A saved look is no one's to keep, whatever the answer
  res.setHeader("Cache-Control", "private, no-store")
  const design = await openedDesign(req)
  res.json({ layout: await designLayout(req, design) })
}
