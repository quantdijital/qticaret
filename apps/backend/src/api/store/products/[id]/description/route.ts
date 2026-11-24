import type { MedusaResponse, MedusaStoreRequest } from "@medusajs/framework/http"
import { storeProductDescription } from "./read"
import { varyOnPublishableKey } from "../../../../../lib/http/vary"

/**
 * GET /store/products/:id/description (adr/0055): the product's
 * description document as HTML, or null for plain text only, and its
 * short description's (adr/0055 Ek 2026-11-06), or null without one.
 */
export async function GET(req: MedusaStoreRequest, res: MedusaResponse): Promise<void> {
  const answer = await storeProductDescription(
    req.scope,
    req.params["id"] ?? "",
    req.publishable_key_context.sales_channel_ids
  )
  res.setHeader("Cache-Control", "public, max-age=60")
  varyOnPublishableKey(res)
  res.json(answer)
}
