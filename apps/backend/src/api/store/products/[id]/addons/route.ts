import type { MedusaResponse, MedusaStoreRequest } from "@medusajs/framework/http"
import { storeProductAddons } from "../../../../../workflows/addons/views"
import { varyOnPublishableKey } from "../../../../../lib/http/vary"

/**
 * GET /store/products/:id/addons (adr/0052): the product's add-ons for
 * its page; behind the shop's `catalog.addons` flag.
 */
export async function GET(req: MedusaStoreRequest, res: MedusaResponse): Promise<void> {
  const addons = await storeProductAddons(
    req.scope,
    req.params["id"] ?? "",
    req.publishable_key_context.sales_channel_ids
  )
  res.setHeader("Cache-Control", "public, max-age=60")
  varyOnPublishableKey(res)
  res.json({ addons })
}
