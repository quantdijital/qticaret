import type { MedusaContainer } from "@medusajs/framework/types"
import {
  StepResponse,
  WorkflowResponse,
  createStep,
  createWorkflow,
} from "@medusajs/framework/workflows-sdk"
import { acquireLockStep, releaseLockStep } from "@medusajs/medusa/core-flows"
import { errorSummary, logger } from "../../../lib/logging"
import { readAddonCart } from "../../addons/cart"
import { slotLinesOf, trimHoldToLines } from "./review"
import { bookingService } from "./target"

type Container = Pick<MedusaContainer, "resolve">

/**
 * The cart's hold brought down to its dated lines: a line removed through
 * Medusa's own route (or a quantity of 0) gives its places back here. It
 * only ever gives back; a completed cart's hold is the order's to confirm
 * and is left alone. A departure that no longer reads (gone, unpublished)
 * keeps its places until the sweep or the checkout's check.
 */
export async function syncCartHold(container: Container, cartId: string): Promise<boolean> {
  const hold = await bookingService(container).cartHold(cartId)
  if (!hold?.live) {
    return false
  }
  const cart = await readAddonCart(container, cartId)
  if (!cart || cart.completed_at) {
    return false
  }
  try {
    const slots = (await slotLinesOf(container, cart, { sells: false })) ?? []
    const after = await trimHoldToLines(container, cartId, slots)
    return JSON.stringify(after?.slots ?? []) !== JSON.stringify(hold.slots)
  } catch (error) {
    logger.warn({ event: "booking.hold_sync_skipped", cart_id: cartId, err: errorSummary(error) })
    return false
  }
}

export const syncCartHoldStep = createStep(
  "booking-sync-cart-hold",
  async (input: { cart_id: string }, { container }) =>
    new StepResponse(await syncCartHold(container, input.cart_id))
)

/** `syncCartHold` under the cart's lock, as the booking route changes the hold. */
export const syncCartHoldWorkflow = createWorkflow(
  "booking-sync-cart-hold",
  (input: { cart_id: string }) => {
    acquireLockStep({ key: input.cart_id, timeout: 10, ttl: 30 })
    const changed = syncCartHoldStep(input)
    releaseLockStep({ key: input.cart_id })
    return new WorkflowResponse(changed)
  }
)
