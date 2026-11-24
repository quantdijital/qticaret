import type { MedusaResponse, MedusaStoreRequest } from "@medusajs/framework/http"
import { storeProductProgram } from "../../../../../workflows/booking/program-view"

/**
 * GET /store/products/:id/program (adr/0078): a dated product's program
 * for its page, behind `catalog.booking`; null when it has none. Changes
 * only when staff save it: a minute's shared cache, as the description's.
 */
export async function GET(req: MedusaStoreRequest, res: MedusaResponse): Promise<void> {
  const program = await storeProductProgram(
    req.scope,
    req.params["id"] ?? "",
    req.publishable_key_context.sales_channel_ids
  )
  res.setHeader("Cache-Control", "public, max-age=60")
  res.json({ program })
}
