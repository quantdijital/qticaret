import { Modules } from "@medusajs/framework/utils"
import {
  StepResponse,
  WorkflowResponse,
  createStep,
  createWorkflow,
} from "@medusajs/framework/workflows-sdk"
import { CART_SIGNALS } from "../../lib/fraud/velocity"
import type { CartSignals } from "../../lib/fraud/velocity"

interface Input {
  cart_id: string
  signals: CartSignals
}

/**
 * Leaves on the cart what its checkout counted (F15.6, adr/0044 §3), for
 * the order's score: how many e-mails its address and its phone used.
 * Numbers only. Undone by putting the cart's metadata back.
 */
const noteCheckoutStep = createStep(
  "fraud-note-checkout",
  async (input: Input, { container }) => {
    const carts = container.resolve(Modules.CART)
    const cart = await carts.retrieveCart(input.cart_id, { select: ["id", "metadata"] })
    const before = cart.metadata ?? null
    await carts.updateCarts(input.cart_id, {
      metadata: { ...before, [CART_SIGNALS]: input.signals },
    })
    return new StepResponse(null, { cart_id: input.cart_id, before })
  },
  async (undo, { container }) => {
    if (!undo) {
      return
    }
    await container.resolve(Modules.CART).updateCarts(undo.cart_id, { metadata: undo.before ?? {} })
  }
)

export const noteCheckoutWorkflow = createWorkflow("fraud-note-checkout", (input: Input) => {
  noteCheckoutStep(input)
  return new WorkflowResponse(null)
})
