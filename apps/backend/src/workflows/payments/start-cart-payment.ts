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
import { repriceAddonLinesStep } from "../addons/checkout"
import { assertWholesaleCartStep, checkWholesaleCartStep } from "../wholesale/checkout-start"
import { paymentBasket } from "../../lib/payments/basket"
import { HOSTED_CHECKOUT, isHostedFormProvider } from "../../lib/payments/checkout"
import type { HostedCheckout } from "../../lib/payments/checkout"
import { checkCartStockStep } from "./steps/cart-stock"
import { offlineSessionDataStep } from "./steps/offline-session"
import { readCheckoutCartStep } from "./steps/read-checkout-cart"
import { dropUnneededShippingStep } from "../checkout/unneeded-shipping"
import { applyPaymentFeeStep, checkPaymentFeeStep } from "./steps/payment-fee"
import { readPaymentCollectionStep } from "./steps/read-payment-collection"
import { recordPaymentFormStep } from "./steps/record-payment-form"

export interface StartCartPaymentInput {
  cart_id: string
  provider_id: string
  sales_channel_ids: string[]
  /** The shopper's address, as the server saw the request. */
  ip: string
  /** A hosted form's return addresses; null for a way to pay that sends nobody anywhere. */
  return_urls: HostedCheckout["return_urls"] | null
}

/**
 * Starts a payment for a cart (adr/0026 §1, adr/0029). Everything the
 * provider is given comes from the server: for a hosted form the buyer
 * and the basket (F4.7 shares, credit spread over the lines), for bank
 * transfer the shop's account, for cash on delivery its fee; always the
 * amount, which is the payment collection's, brought up to the cart
 * first. Medusa replaces the collection's earlier sessions: each attempt
 * is a new reference.
 */
export const startCartPaymentWorkflow = createWorkflow(
  "payments-start-cart-payment",
  (input: StartCartPaymentInput) => {
    // Add-on lines at their price now, or the start stops for the shopper to see it (adr/0052 §5)
    repriceAddonLinesStep({
      cart_id: input.cart_id,
      sales_channel_ids: input.sales_channel_ids,
    })
    // A wholesaler's minimum, and every cart at its customer's prices now, or the start
    // stops for the shopper to see them (ADR-0068 §7, §8); after the add-on step's own cart check
    checkWholesaleCartStep({ cart_id: input.cart_id })
    // Cash on delivery's fee line put right first: Medusa's cart workflows that
    // change lines take the cart's lock themselves (adr/0029)
    const fee = applyPaymentFeeStep({
      cart_id: input.cart_id,
      provider_id: input.provider_id,
      sales_channel_ids: input.sales_channel_ids,
    })
    // The cart's own lock, as Medusa's cart workflows take it: the cart cannot
    // change between reading its amount and starting the session for it
    acquireLockStep({ key: input.cart_id, timeout: 5, ttl: 30 })
    // A shipping method left on a cart that ships nothing goes (adr/0076 Ek D5)
    dropUnneededShippingStep({ cart_id: input.cart_id })
    checkPaymentFeeStep({ cart_id: input.cart_id, fee: fee.fee })
    // Units another order took since they were put in the cart (adr/0026 Ek 2026-11-06)
    checkCartStockStep(input.cart_id)
    // The wholesale rules once more under the lock, as the completion reads them (review N2)
    assertWholesaleCartStep({ cart_id: input.cart_id })
    const cart = readCheckoutCartStep({
      cart_id: input.cart_id,
      sales_channel_ids: input.sales_channel_ids,
      provider_id: input.provider_id,
    })
    const offline = offlineSessionDataStep({ provider_id: input.provider_id, fee: fee.fee })
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
      input: transform(
        { input, cart, collection, offline },
        ({ input, cart, collection, offline }) => {
          // Only a hosted form is given the buyer and the basket (adr/0029: offline ways need none)
          const checkout: HostedCheckout | null =
            isHostedFormProvider(input.provider_id) && input.return_urls
              ? {
                  email: cart.email,
                  buyer: cart.buyer,
                  ip: input.ip,
                  return_urls: input.return_urls,
                  basket: paymentBasket(cart.lines, collection.amount),
                }
              : null
          return {
            payment_collection_id: collection.id,
            provider_id: input.provider_id,
            data: checkout ? { checkout } : offline,
            context: { [HOSTED_CHECKOUT]: true },
          }
        }
      ),
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
