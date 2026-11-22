import type { MedusaContainer } from "@medusajs/framework/types"
import { COMPLETION_HOLD_MINUTES, PAYMENT_HOLD_MINUTES } from "../../../lib/booking/cart-lines"
import { ConflictError } from "../../../lib/errors"
import type { CartHold } from "../../../modules/booking/service"
import { readAddonCart } from "../../addons/cart"
import type { AddonCart } from "../../addons/cart"
import { holdMatches, slotLinesOf, staleBookingLines, trimHoldToLines } from "./review"
import type { SlotLines } from "./review"
import { bookingService } from "./target"

type Container = Pick<MedusaContainer, "resolve">

/**
 * The cart's places still its own and its dated lines still right: the
 * hold live and the one every line was taken under, keeping exactly the
 * places the lines take, every departure still selling, every price what
 * the departure costs in the cart now.
 */
async function assertHeldAndPriced(
  container: Container,
  cart: AddonCart,
  slots: readonly SlotLines[],
  hold: CartHold | null
): Promise<void> {
  if (!hold?.live) {
    throw new ConflictError("booking.hold_expired")
  }
  const marks = slots.flatMap((slot) => slot.lines.map(({ mark }) => mark.hold_id))
  if (marks.some((holdId) => holdId !== hold.hold_id)) {
    throw new ConflictError("booking.hold_expired")
  }
  if (!holdMatches(hold, slots)) {
    throw new ConflictError("booking.hold_mismatch")
  }
  if ((await staleBookingLines(container, cart, slots)).length > 0) {
    throw new ConflictError("booking.price_changed")
  }
}

/** The hold's end pushed to at least `minutes` from now; refused once it has ended. */
async function extend(container: Container, cartId: string, minutes: number): Promise<void> {
  if (!(await bookingService(container).extendHold(cartId, minutes))) {
    throw new ConflictError("booking.hold_expired")
  }
}

/**
 * Before a payment starts, under the cart's lock (adr/0076 §5): places
 * kept beyond the lines go back, the hold is pushed for the payment's
 * return (`PAYMENT_HOLD_MINUTES`, within its lifetime), and the lines are
 * checked as the completion will. An ended hold stops the payment
 * (409 `booking.hold_expired`): the shopper picks the date again.
 */
export async function prepareBookingPayment(container: Container, cartId: string): Promise<void> {
  const cart = await readAddonCart(container, cartId)
  if (!cart) {
    return
  }
  const slots = await slotLinesOf(container, cart, { sells: true })
  if (!slots) {
    return
  }
  await trimHoldToLines(container, cartId, slots)
  await extend(container, cartId, PAYMENT_HOLD_MINUTES)
  await assertHeldAndPriced(
    container,
    cart,
    slots,
    await bookingService(container).cartHold(cartId)
  )
}

/**
 * At the order's completion (the `complete-cart-validate` chain): the
 * cart's dated lines as `prepareBookingPayment` left them. Passing, the
 * hold is pushed a little (`COMPLETION_HOLD_MINUTES`) so the order's
 * confirmation (`order.placed`) still finds it.
 */
export async function assertBookingLinesCurrent(container: Container, cartId: string) {
  const cart = await readAddonCart(container, cartId)
  if (!cart) {
    return
  }
  const slots = await slotLinesOf(container, cart, { sells: true })
  if (!slots) {
    return
  }
  const service = bookingService(container)
  await assertHeldAndPriced(container, cart, slots, await service.cartHold(cartId))
  await extend(container, cartId, COMPLETION_HOLD_MINUTES)
}
