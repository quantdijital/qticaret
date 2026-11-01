import {
  acquireLockStep,
  createPaymentCollectionForCartWorkflow,
  refreshPaymentCollectionForCartWorkflow,
  releaseLockStep,
} from "@medusajs/medusa/core-flows"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
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
import { readCheckoutCartStep } from "./steps/read-checkout-cart"

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
    const due = fromMedusaAmount(cart?.raw_total ?? cart?.total ?? 0, { allowRounding: true })
    if (due !== 0) {
      throw new ValidationError("payments.amount_due", { field: "provider_id" })
    }
    return new StepResponse({ due })
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
    acquireLockStep({ key: input.cart_id, timeout: 5, ttl: 30 })
    const cart = readCheckoutCartStep({
      cart_id: input.cart_id,
      sales_channel_ids: input.sales_channel_ids,
    })
    checkNothingDueStep({ cart_id: input.cart_id })
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
    releaseLockStep({ key: input.cart_id })
    return new WorkflowResponse({ cart_id: input.cart_id })
  }
)
