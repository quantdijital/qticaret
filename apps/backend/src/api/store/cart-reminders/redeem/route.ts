import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { redeemCartReminderWorkflow } from "../../../../workflows/marketing/cart-reminders"
import type { StorePostCartReminderRedeemType } from "./validators"

/**
 * POST /store/cart-reminders/redeem (F10.7, adr/0038 §1): the cart a
 * reminder's link opens, once. The storefront's return page sends it when
 * the shopper presses its button, then carries on with the cart.
 */
export async function POST(
  req: MedusaRequest<StorePostCartReminderRedeemType>,
  res: MedusaResponse
): Promise<void> {
  const { result } = await redeemCartReminderWorkflow(req.scope).run({
    input: { token: req.validatedBody.token },
  })
  res.json({ cart_id: result.cart_id })
}
