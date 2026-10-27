import type { MedusaResponse, MedusaStoreRequest } from "@medusajs/framework/http"
import { paymentMethods } from "../../../../workflows/payments/payment-methods"
import type { StoreGetPaymentMethodsType } from "./validators"

/**
 * GET /store/payment/methods (F5 V10, F6): the ways a storefront can start
 * a payment with (`POST /store/carts/:id/payment-session`); cash on
 * delivery judged for the cart named.
 */
export const GET = async (
  req: MedusaStoreRequest<unknown, StoreGetPaymentMethodsType>,
  res: MedusaResponse
) => {
  res.json(
    await paymentMethods(req.scope, {
      cart_id: req.validatedQuery.cart_id,
      sales_channel_ids: req.publishable_key_context.sales_channel_ids,
    })
  )
}
