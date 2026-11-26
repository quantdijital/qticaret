import {
  acquireLockStep,
  createPaymentCollectionForCartWorkflow,
  refreshPaymentCollectionForCartWorkflow,
  releaseLockStep,
} from "@medusajs/medusa/core-flows"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import {
  StepResponse,
  WorkflowResponse,
  createStep,
  createWorkflow,
  when,
} from "@medusajs/framework/workflows-sdk"
import { ValidationError } from "../../lib/errors"
import { fromMedusaAmount } from "../../lib/money"
import type { MedusaAmount } from "../../lib/money"
import { repriceAddonLinesStep } from "../addons/checkout"
import { assertFreeShippingConditionStep } from "../promotions/free-shipping-condition"
import { assertWholesaleCartStep, checkWholesaleCartStep } from "../wholesale/checkout-start"
import { applyPaymentFeeStep } from "./steps/payment-fee"
import { readCheckoutCartStep } from "./steps/read-checkout-cart"
import { dropUnneededShippingStep } from "../checkout/unneeded-shipping"

/**
 * Set on the cart by this workflow alone (storefronts cannot write `qt_`
 * metadata): a cart with nothing to pay is completed only once it went
 * through here, with the same guards as every way to pay
 * (`requireCheckoutPayment`, security review 2026-11-02).
 */
export const CREDIT_CHECKOUT_MARK = "qt_credit_checkout"

export interface StartCreditCheckoutInput {
  cart_id: string
  sales_channel_ids: string[]
}

/** The cart owes nothing: its gift cards' and store credit's lines cover it all. */
const checkNothingDueStep = createStep(
  "payments-check-nothing-due",
  async (input: { cart_id: string }, { container }) => {
    const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
      entity: "cart",
      fields: ["id", "total", "raw_total"],
      filters: { id: input.cart_id },
    })
    const cart = data[0] as { total?: MedusaAmount; raw_total?: MedusaAmount } | undefined
    const total = cart?.raw_total ?? cart?.total
    // A total that cannot be read is never taken for nothing due
    if (total === undefined) {
      throw new ValidationError("payments.amount_due", { field: "provider_id" })
    }
    const due = fromMedusaAmount(total, { allowRounding: true })
    if (due !== 0) {
      throw new ValidationError("payments.amount_due", { field: "provider_id" })
    }
    return new StepResponse({ due })
  }
)

/** Marks the cart as started with nothing to pay; undone, the mark goes. */
const markCreditCheckoutStep = createStep(
  "payments-mark-credit-checkout",
  async (input: { cart_id: string }, { container }) => {
    const carts = container.resolve(Modules.CART)
    const cart = await carts.retrieveCart(input.cart_id, { select: ["id", "metadata"] })
    const before = cart.metadata ?? null
    await carts.updateCarts(input.cart_id, {
      metadata: { ...(before ?? {}), [CREDIT_CHECKOUT_MARK]: new Date().toISOString() },
    })
    return new StepResponse(null, { id: input.cart_id, metadata: before })
  },
  async (previous, { container }) => {
    if (previous) {
      await container
        .resolve(Modules.CART)
        .updateCarts(previous.id, { metadata: previous.metadata ?? {} })
    }
  }
)

/**
 * A cart its credit lines pay in full (F4.8 gift cards, F18): no provider
 * and no session, only the payment collection at 0 brought up to the cart,
 * as the order's completion checks (`complete-cart-validate`: the
 * collection must match the cart's total). Under the cart's own lock, after
 * the same readiness checks as every payment (contracts, age, address).
 */
export const startCreditCheckoutWorkflow = createWorkflow(
  "payments-start-credit-checkout",
  (input: StartCreditCheckoutInput) => {
    // Add-on lines at their price now (adr/0052 §5)
    repriceAddonLinesStep({
      cart_id: input.cart_id,
      sales_channel_ids: input.sales_channel_ids,
    })
    // A wholesaler's minimum, and every cart at its customer's prices now, or the start
    // stops for the shopper to see them (ADR-0068 §7, §8); after the add-on step's own cart check
    checkWholesaleCartStep({ cart_id: input.cart_id })
    // A cash on delivery fee line left from an earlier choice goes (no fee without a way to pay)
    applyPaymentFeeStep({
      cart_id: input.cart_id,
      provider_id: "credit",
      sales_channel_ids: input.sales_channel_ids,
    })
    acquireLockStep({ key: input.cart_id, timeout: 5, ttl: 30 })
    // A shipping method left on a cart that ships nothing goes (adr/0076 Ek D5)
    dropUnneededShippingStep({ cart_id: input.cart_id })
    // A gift card is never paid with gift cards or store credit (adr/0025 Ek 2026-11-03)
    const cart = readCheckoutCartStep({
      cart_id: input.cart_id,
      sales_channel_ids: input.sales_channel_ids,
      provider_id: "credit",
    })
    checkNothingDueStep({ cart_id: input.cart_id })
    // The wholesale rules once more under the lock, as the completion reads them (review N2)
    assertWholesaleCartStep({ cart_id: input.cart_id })
    // Free shipping only as the shop's condition allows it now (Kargo ücreti, "Koşul")
    assertFreeShippingConditionStep({ cart_id: input.cart_id })
    when(
      "payments-credit-create-collection",
      { cart },
      ({ cart }) => !cart.payment_collection_id
    ).then(() => {
      createPaymentCollectionForCartWorkflow.runAsStep({ input: { cart_id: input.cart_id } })
    })
    when("payments-credit-refresh-collection", { cart }, ({ cart }) =>
      Boolean(cart.payment_collection_id)
    ).then(() => {
      refreshPaymentCollectionForCartWorkflow.runAsStep({ input: { cart_id: input.cart_id } })
    })
    markCreditCheckoutStep({ cart_id: input.cart_id })
    releaseLockStep({ key: input.cart_id })
    return new WorkflowResponse({ cart_id: input.cart_id })
  }
)
