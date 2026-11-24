import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { listingDescriptionHtml } from "../../../../lib/catalog/listing-description"
import { storeCategoryDoc } from "../../../../workflows/catalog/category-description"
import { varyOnPublishableKey } from "../../../../lib/http/vary"

/**
 * GET /store/category-descriptions/:id (adr/0075): a shown category's text
 * as the shop formatted it, rendered on the server, for the foot of its
 * page; `description_html` null: plain text only (Medusa's `description`).
 * A hidden or internal category is not found. The same for everyone;
 * kept a minute.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const id = req.params["id"] ?? ""
  const stored = await storeCategoryDoc(req.scope, id)
  res.setHeader("Cache-Control", "public, max-age=60, stale-while-revalidate=300")
  varyOnPublishableKey(res)
  res.json({ category_id: id, description_html: listingDescriptionHtml(stored) })
}
