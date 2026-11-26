import type { MedusaResponse, MedusaStoreRequest } from "@medusajs/framework/http"
import { setOrderNoteWorkflow } from "../../../../../workflows/checkout/order-note"
import type { StorePostCartOrderNoteType } from "./validators"

/**
 * POST /store/carts/:id/order-note (Batch 8 / O1): the shopper's note for
 * the shop, kept on their open cart until it becomes the order's. Sent
 * again, the last one counts; empty, there is none.
 */
export async function POST(
  req: MedusaStoreRequest<StorePostCartOrderNoteType>,
  res: MedusaResponse
): Promise<void> {
  const { result } = await setOrderNoteWorkflow(req.scope).run({
    input: {
      cart_id: req.params["id"] ?? "",
      sales_channel_ids: req.publishable_key_context.sales_channel_ids,
      note: req.validatedBody.note,
    },
  })
  res.json({ order_note: result.note })
}
