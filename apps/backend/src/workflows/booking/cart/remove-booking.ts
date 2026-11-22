import {
  StepResponse,
  WorkflowResponse,
  createStep,
  createWorkflow,
  transform,
  when,
} from "@medusajs/framework/workflows-sdk"
import {
  acquireLockStep,
  deleteLineItemsWorkflow,
  releaseLockStep,
} from "@medusajs/medusa/core-flows"
import { MedusaError } from "@medusajs/framework/utils"
import { lineIdsOfSlot, openCart, unitsHeld } from "./plan"
import { minutesLeft } from "./review"
import { holdCartUnitsStep } from "./set-booking"
import type { HoldChange } from "./set-booking"
import { bookingService } from "./target"

export interface RemoveCartBookingInput {
  cart_id: string
  slot_id: string
  sales_channel_ids: string[]
}

interface RemovePlan {
  cart_id: string
  line_ids: string[]
  change: HoldChange
}

/**
 * What leaving a departure takes: the cart's lines of it and its places.
 * A departure the cart has nothing of is a 404 (no lines, nothing held).
 */
export const planRemoveBookingStep = createStep(
  "booking-plan-remove",
  async (input: RemoveCartBookingInput, { container }) => {
    const cart = await openCart(container, input.cart_id, input.sales_channel_ids)
    const lineIds = lineIdsOfSlot(cart, input.slot_id)
    const before = await unitsHeld(container, cart.id, input.slot_id)
    if (lineIds.length === 0 && before === 0) {
      throw new MedusaError(MedusaError.Types.NOT_FOUND, "booking.slot_unknown")
    }
    const hold = await bookingService(container).cartHold(cart.id)
    const minutes = hold?.live ? minutesLeft(hold) : 1
    const plan: RemovePlan = {
      cart_id: cart.id,
      line_ids: lineIds,
      change: { cart_id: cart.id, slot_id: input.slot_id, units: 0, units_before: before, minutes },
    }
    return new StepResponse(plan)
  }
)

/**
 * DELETE /store/carts/:id/bookings/:slot_id (adr/0076 §5): the departure
 * leaves the cart, under its lock: its places given back (the hold keeps
 * its end), then its lines removed through Medusa's own line removal.
 * A failure puts the places back.
 */
export const removeCartBookingWorkflow = createWorkflow(
  "booking-remove-cart",
  (input: RemoveCartBookingInput) => {
    acquireLockStep({ key: input.cart_id, timeout: 5, ttl: 30 })
    const plan = planRemoveBookingStep(input)
    when("booking-remove-held", { plan }, ({ plan }) => plan.change.units_before > 0).then(() => {
      holdCartUnitsStep(transform({ plan }, ({ plan }) => plan.change)).config({
        name: "booking-release-cart-units",
      })
    })
    when("booking-remove-lines", { plan }, ({ plan }) => plan.line_ids.length > 0).then(() => {
      deleteLineItemsWorkflow.runAsStep({
        input: transform({ plan }, ({ plan }) => ({ cart_id: plan.cart_id, ids: plan.line_ids })),
      })
    })
    releaseLockStep({ key: input.cart_id })
    return new WorkflowResponse(
      transform({ plan }, ({ plan }) => ({ slot_id: plan.change.slot_id, removed: plan.line_ids }))
    )
  }
)
