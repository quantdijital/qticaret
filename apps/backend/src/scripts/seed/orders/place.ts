import type { MedusaContainer } from "@medusajs/framework/types"
import {
  addShippingMethodToCartWorkflow,
  completeCartWorkflow,
  createCartWorkflow,
  createPaymentCollectionForCartWorkflow,
  createPaymentSessionsWorkflow,
} from "@medusajs/medusa/core-flows"
import { SYSTEM_PAYMENT_PROVIDER_ID } from "../../bootstrap/constants"

export interface PlaceOrderInput {
  regionId: string
  salesChannelId: string
  shippingOptionId: string
  items: { variant_id: string; quantity: number }[]
  /** Turkish address fields as F1.4 stores them: il in province, ilçe in city. */
  address: {
    first_name: string
    last_name: string
    address_1: string
    province?: string
    city?: string
  }
}

/**
 * An order the way a shopper places one: cart, shipping, the system
 * payment provider (which authorizes), checkout. No email, so no customer
 * record is made. Returns the order's id.
 */
export async function placeOrder(
  container: MedusaContainer,
  input: PlaceOrderInput
): Promise<string> {
  const { result: cart } = await createCartWorkflow(container).run({
    input: {
      region_id: input.regionId,
      sales_channel_id: input.salesChannelId,
      currency_code: "try",
      items: input.items,
      shipping_address: { ...input.address, country_code: "tr" },
      billing_address: { ...input.address, country_code: "tr" },
    },
  })
  await addShippingMethodToCartWorkflow(container).run({
    input: { cart_id: cart.id, options: [{ id: input.shippingOptionId }] },
  })
  const { result: collection } = await createPaymentCollectionForCartWorkflow(container).run({
    input: { cart_id: cart.id },
  })
  await createPaymentSessionsWorkflow(container).run({
    input: { payment_collection_id: collection.id, provider_id: SYSTEM_PAYMENT_PROVIDER_ID },
  })
  const { result } = await completeCartWorkflow(container).run({ input: { id: cart.id } })
  return result.id
}
