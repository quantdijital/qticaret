import type { MedusaResponse, MedusaStoreRequest } from "@medusajs/framework/http"
import { setGiftRecipientWorkflow } from "../../../../../../../workflows/gift-cards/cart-gifts"
import type { StorePostGiftRecipientType } from "./validators"

/**
 * POST /store/carts/:id/line-items/:line_id/gift (adr/0025 Ek 2026-11-03):
 * the recipient of a gift card line; sent again, it replaces the last.
 * A line of another product is refused (400 `gift_card.not_gift_line`).
 */
export async function POST(
  req: MedusaStoreRequest<StorePostGiftRecipientType>,
  res: MedusaResponse
): Promise<void> {
  const body = req.validatedBody
  const { result } = await setGiftRecipientWorkflow(req.scope).run({
    input: {
      cart_id: req.params["id"] ?? "",
      line_id: req.params["line_id"] ?? "",
      sales_channel_ids: req.publishable_key_context.sales_channel_ids,
      gift: {
        recipient_email: body.recipient_email,
        recipient_name: body.recipient_name ?? null,
        message: body.message ?? null,
        sender_name: body.sender_name ?? null,
      },
    },
  })
  res.setHeader("Cache-Control", "no-store")
  res.json({ gift_line: result })
}
