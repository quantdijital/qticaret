import {
  acquireLockStep,
  createPaymentCollectionForCartWorkflow,
  createPaymentSessionsWorkflow,
  refreshPaymentCollectionForCartWorkflow,
  releaseLockStep,
} from "@medusajs/medusa/core-flows"
import {
  WorkflowResponse,
  createWorkflow,
  transform,
  when,
} from "@medusajs/framework/workflows-sdk"
import { paymentBasket } from "../../lib/payments/basket"
import { HOSTED_CHECKOUT } from "../../lib/payments/checkout"
import type { HostedCheckout } from "../../lib/payments/checkout"
import { readCheckoutCartStep } from "./steps/read-checkout-cart"
import { readPaymentCollectionStep } from "./steps/read-payment-collection"
import { recordPaymentFormStep } from "./steps/record-payment-form"

export interface StartCartPaymentInput {
  cart_id: string
  provider_id: string
  sales_channel_ids: string[]
  /** The shopper's address, as the server saw the request. */
  ip: string
  return_urls: HostedCheckout["return_urls"]
}

/**
 * Starts a hosted-form payment for a cart (adr/0026 §1). Everything the
 * provider is given comes from the stored cart: the buyer, the basket
 * (F4.7 shares, credit spread over the lines) and the amount, which is the
 * payment collection's, brought up to the cart first. Medusa replaces the
 * collection's earlier sessions: each attempt is a new reference.
 */
export const startCartPaymentWorkflow = createWorkflow(
  "payments-start-cart-payment",
  (input: StartCartPaymentInput) => {
    // The cart's own lock, as Medusa's cart workflows take it: the cart cannot
    // change between reading its amount and starting the session for it
    acquireLockStep({ key: input.cart_id, timeout: 5, ttl: 30 })
    const cart = readCheckoutCartStep({
      cart_id: input.cart_id,
      sales_channel_ids: input.sales_channel_ids,
    })
    when("payments-create-collection", { cart }, ({ cart }) => !cart.payment_collection_id).then(
      () => {
        createPaymentCollectionForCartWorkflow.runAsStep({ input: { cart_id: input.cart_id } })
      }
    )
    when("payments-refresh-collection", { cart }, ({ cart }) =>
      Boolean(cart.payment_collection_id)
    ).then(() => {
      refreshPaymentCollectionForCartWorkflow.runAsStep({ input: { cart_id: input.cart_id } })
    })
    const collection = readPaymentCollectionStep(input.cart_id)
    const session = createPaymentSessionsWorkflow.runAsStep({
      input: transform({ input, cart, collection }, ({ input, cart, collection }) => {
        const checkout: HostedCheckout = {
          email: cart.email,
          buyer: cart.buyer,
          ip: input.ip,
          return_urls: input.return_urls,
          basket: paymentBasket(cart.lines, collection.amount),
        }
        return {
          payment_collection_id: collection.id,
          provider_id: input.provider_id,
          data: { checkout },
          context: { [HOSTED_CHECKOUT]: true },
        }
      }),
    })
    recordPaymentFormStep(
      transform({ input, session }, ({ input, session }) => ({
        provider_id: input.provider_id,
        session_id: session.id,
        cart_id: input.cart_id,
        data: session.data,
      }))
    )
    releaseLockStep({ key: input.cart_id })
    return new WorkflowResponse(session)
  }
)
