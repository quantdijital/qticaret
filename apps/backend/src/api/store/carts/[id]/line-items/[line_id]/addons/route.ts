import type { MedusaResponse, MedusaStoreRequest } from "@medusajs/framework/http"
import { addonLineView } from "../../../../../../../workflows/addons/views"
import { setLineAddonsWorkflow } from "../../../../../../../workflows/addons/set-line"
import type { StorePostLineAddonsType } from "./validators"

/**
 * POST /store/carts/:id/line-items/:line_id/addons (adr/0052): the line's
 * add-ons, priced on the server; the line comes back with its new unit
 * price and what it records of them. An empty list takes them off.
 */
export async function POST(
  req: MedusaStoreRequest<StorePostLineAddonsType>,
  res: MedusaResponse
): Promise<void> {
  const cartId = req.params["id"] ?? ""
  const { result } = await setLineAddonsWorkflow(req.scope).run({
    input: {
      cart_id: cartId,
      line_id: req.params["line_id"] ?? "",
      sales_channel_ids: req.publishable_key_context.sales_channel_ids,
      selections: req.validatedBody.selections,
    },
  })
  res.setHeader("Cache-Control", "no-store")
  res.json({ line: await addonLineView(req.scope, cartId, result.line_id) })
}
