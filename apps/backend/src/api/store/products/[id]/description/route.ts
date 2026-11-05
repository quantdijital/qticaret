import type { MedusaResponse, MedusaStoreRequest } from "@medusajs/framework/http"
import { storeProductDescription } from "./read"

/**
 * GET /store/products/:id/description (adr/0055): the product's
 * description document as HTML, or null for plain text only.
 */
export async function GET(req: MedusaStoreRequest, res: MedusaResponse): Promise<void> {
  const answer = await storeProductDescription(
    req.scope,
    req.params["id"] ?? "",
    req.publishable_key_context.sales_channel_ids
  )
  res.setHeader("Cache-Control", "public, max-age=60")
  res.json(answer)
}
