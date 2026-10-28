import { Modules } from "@medusajs/framework/utils"
import {
  StepResponse,
  WorkflowResponse,
  createStep,
  createWorkflow,
} from "@medusajs/framework/workflows-sdk"
import { CHECKOUT_SMS_HELD } from "../../lib/messaging/sms/quota"

/**
 * Marks the cart so its order sends no texts (F10 M9): its visitor's
 * address completed too many carts this hour. Nothing to undo: the mark
 * holds texts back and calls no one.
 */
const holdCheckoutSmsStep = createStep(
  "messaging-hold-checkout-sms",
  async (input: { cart_id: string }, { container }) => {
    const carts = container.resolve(Modules.CART)
    const cart = await carts.retrieveCart(input.cart_id, { select: ["id", "metadata"] })
    if (cart.metadata?.[CHECKOUT_SMS_HELD] !== true) {
      await carts.updateCarts(input.cart_id, {
        metadata: { ...cart.metadata, [CHECKOUT_SMS_HELD]: true },
      })
    }
    return new StepResponse({ held: true })
  }
)

/** A checkout from a flooding address: its order's "order received" text is held. */
export const holdCheckoutSmsWorkflow = createWorkflow(
  "messaging-hold-checkout-sms",
  (input: { cart_id: string }) => new WorkflowResponse(holdCheckoutSmsStep(input))
)
