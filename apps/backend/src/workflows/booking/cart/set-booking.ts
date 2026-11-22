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
  addToCartWorkflow,
  deleteLineItemsWorkflow,
  releaseLockStep,
} from "@medusajs/medusa/core-flows"
import { errorSummary, logger } from "../../../lib/logging"
import { cartItemsOf, planCartBooking } from "./plan"
import type { CartBookingInput, CartBookingPlan } from "./plan"
import { bookingService } from "./target"

/** The plan made under the cart's lock; reads only. */
export const planCartBookingStep = createStep(
  "booking-plan-cart",
  async (input: CartBookingInput, { container }) =>
    new StepResponse(await planCartBooking(container, input))
)

export interface HoldChange {
  cart_id: string
  slot_id: string
  units: number
  units_before: number
  minutes: number
}

/**
 * The cart's places on the departure set to what its lines will take
 * (one conditional statement per slot in the module: a full or closed
 * departure refuses, 409). Undone, the slot goes back to what the hold
 * kept before; a slot it no longer fits on is logged (the places freed
 * here were taken meanwhile) and the sweep frees what is left.
 */
export const holdCartUnitsStep = createStep(
  "booking-hold-cart-units",
  async (change: HoldChange, { container }) => {
    const hold = await bookingService(container).holdUnits(
      change.cart_id,
      [{ slotId: change.slot_id, units: change.units }],
      change.minutes
    )
    return new StepResponse(
      { hold_id: hold?.hold_id ?? null, expires_at: hold?.expires_at ?? null },
      change
    )
  },
  async (change, { container }) => {
    if (!change) {
      return
    }
    try {
      await bookingService(container).holdUnits(
        change.cart_id,
        [{ slotId: change.slot_id, units: change.units_before }],
        change.minutes
      )
    } catch (error) {
      logger.warn({
        event: "booking.hold_undo_failed",
        cart_id: change.cart_id,
        slot_id: change.slot_id,
        err: errorSummary(error),
      })
    }
  }
)

const holdChangeOf = (plan: CartBookingPlan, units: number): HoldChange => ({
  cart_id: plan.cart_id,
  slot_id: plan.slot_id,
  units,
  units_before: plan.units_before,
  minutes: plan.hold_minutes,
})

/**
 * POST /store/carts/:id/bookings (adr/0076 §5): a departure's places in
 * the cart. Under the cart's lock: the request checked and priced, the
 * places held, the departure's lines replaced by lines at the server's
 * price, each marked with the hold (`qt_booking`). Sent again for the
 * same departure, its lines become the new ones. Medusa's line writes run
 * nested, without their own lock (2.21.2), and put taxes, promotions and
 * the payment collection right; any step failing undoes the ones before.
 */
export const setCartBookingWorkflow = createWorkflow(
  "booking-set-cart",
  (input: CartBookingInput) => {
    acquireLockStep({ key: input.cart_id, timeout: 5, ttl: 30 })
    const plan = planCartBookingStep(input)
    const hold = holdCartUnitsStep(
      transform({ plan }, ({ plan }) => holdChangeOf(plan, plan.units))
    )
    when("booking-replace-lines", { plan }, ({ plan }) => plan.replaced_line_ids.length > 0).then(
      () => {
        deleteLineItemsWorkflow.runAsStep({
          input: transform({ plan }, ({ plan }) => ({
            cart_id: plan.cart_id,
            ids: plan.replaced_line_ids,
          })),
        })
      }
    )
    addToCartWorkflow.runAsStep({
      input: transform({ plan, hold }, ({ plan, hold }) => ({
        cart_id: plan.cart_id,
        items: cartItemsOf(plan, hold.hold_id ?? ""),
      })),
    })
    releaseLockStep({ key: input.cart_id })
    return new WorkflowResponse(
      transform({ plan, hold }, ({ plan, hold }) => ({
        slot_id: plan.slot_id,
        units: plan.units,
        expires_at: hold.expires_at,
      }))
    )
  }
)

export { holdChangeOf }
