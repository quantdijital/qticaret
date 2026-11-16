import type { MedusaContainer } from "@medusajs/framework/types"
import { StepResponse, createStep } from "@medusajs/framework/workflows-sdk"
import { ConflictError } from "../../lib/errors"
import { errorSummary, logger } from "../../lib/logging"
import { fromMedusaAmount } from "../../lib/money"
import { alertPaymentIssue } from "../payments/issue-alert"
import {
  assertMinimum,
  assertWholesaleCartCompletes,
  needsPricing,
  readCart,
  reviewWholesaleCart,
} from "./checkout"
import type { CheckoutCart } from "./checkout"
import { repriceCartWorkflow } from "./steps/carts"

/** What the shopper pays: the cart's total and its lines' prices (a promotion's link alone is not). */
const paidState = (cart: CheckoutCart | undefined): string =>
  JSON.stringify([
    cart?.total === null || cart?.total === undefined
      ? null
      : fromMedusaAmount(cart.total, { allowRounding: true }),
    (cart?.items ?? []).flatMap((line) =>
      line ? [[line.id, fromMedusaAmount(line.unit_price, { allowRounding: true })]] : []
    ),
  ])

/** The start stops without telling the shopper why inside: nothing of Medusa's leaves here. */
const unavailable = () => new ConflictError("wholesale.payment_unavailable")

/** Medusa's refresh, its own failure (a line no longer sold) logged with the cart, never shown. */
async function reprice(container: MedusaContainer, cartId: string): Promise<void> {
  try {
    await repriceCartWorkflow(container).run({ input: { cart_id: cartId } })
  } catch (error) {
    logger.warn({
      event: "wholesale.checkout_reprice_failed",
      cart_id: cartId,
      err: errorSummary(error),
    })
    throw unavailable()
  }
}

/**
 * Before a payment starts (ADR-0068 §7, §8; review M1): a wholesaler's
 * cart short of its minimum is refused (`wholesale.min_quantity`); a cart
 * not at its customer's prices now, or a wholesaler's carrying a
 * promotion, is priced again by Medusa's own refresh (it takes the cart's
 * lock, so this runs before the start takes it) and judged again by the
 * same rule the order's completion applies (`needsPricing`):
 * - right now and what is paid changed: the start stops with 409
 *   `wholesale.prices_changed`, the shopper sees the new total before
 *   paying it; the prices stay, they are the right ones;
 * - right now and only a promotion's link went: the start goes on;
 * - still not right (this check and Medusa read a price differently):
 *   logged as an error with the cart, the shop told once per cart
 *   (`payments.wholesale_price_check`, review N3), and the start stops
 *   with 409 `wholesale.payment_unavailable` (review Y2): the completion
 *   would refuse it after a card was charged;
 * - the refresh itself failing (review N4): logged, the same 409.
 * A cart this lets through is one the completion lets through too,
 * nothing changing in between.
 */
export async function checkWholesaleCartForPayment(
  container: MedusaContainer,
  cartId: string
): Promise<{ repriced: boolean }> {
  const cart = await readCart(container, cartId)
  // The start's own steps answer an unknown or completed cart
  const review = !cart || cart.completed_at ? null : await reviewWholesaleCart(container, cart)
  if (!cart || !review) {
    return { repriced: false }
  }
  assertMinimum(review)
  if (!needsPricing(review)) {
    return { repriced: false }
  }
  await reprice(container, cart.id)
  const after = await readCart(container, cart.id)
  const again = await reviewWholesaleCart(container, after)
  if (again && needsPricing(again)) {
    logger.error({
      event: "wholesale.price_check_diverged",
      cart_id: cart.id,
      lines: again.stale.length,
      promotions: again.promotions,
    })
    await alertPaymentIssue(container, {
      issue: "wholesale_price_check",
      provider: "wholesale",
      reference: cart.id,
      cart_id: cart.id,
    })
    throw unavailable()
  }
  if (paidState(after) !== paidState(cart)) {
    throw new ConflictError("wholesale.prices_changed")
  }
  return { repriced: true }
}

/** `checkWholesaleCartForPayment` as the payment start's step. Nothing to undo: the prices are right. */
export const checkWholesaleCartStep = createStep(
  "wholesale-check-checkout-cart",
  async (input: { cart_id: string }, { container }) =>
    new StepResponse(await checkWholesaleCartForPayment(container, input.cart_id))
)

/**
 * Under the cart's lock, just before the session is made (review N2): the
 * completion's own check, reads only. Nothing can change the cart between
 * this and the session; a change after it is the completion's to refuse.
 */
export const assertWholesaleCartStep = createStep(
  "wholesale-assert-checkout-cart",
  async (input: { cart_id: string }, { container }) => {
    await assertWholesaleCartCompletes(container, input.cart_id)
    return new StepResponse(null)
  }
)
