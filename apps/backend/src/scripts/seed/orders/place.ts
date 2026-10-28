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
  /** None for a cart with nothing to ship (digital or service lines, F3.2). */
  shippingOptionId?: string | undefined
  items: { variant_id: string; quantity: number }[]
  /** Codes applied to the cart, as a shopper types them (F4.4). */
  promo_codes?: string[] | undefined
  /** Where the order's messages go; none by default, so no message is sent. */
  email?: string | undefined
  /** What the shopper does on the cart before paying (a test ticks consent boxes, F10). */
  beforeComplete?: ((cartId: string) => Promise<void>) | undefined
  /** Turkish address fields as F1.4 stores them: il in province, ilçe in city. */
  address: {
    first_name: string
    last_name: string
    address_1: string
    address_2?: string
    province?: string
    city?: string
    postal_code?: string
    phone?: string
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
      ...(input.promo_codes ? { promo_codes: input.promo_codes } : {}),
      ...(input.email ? { email: input.email } : {}),
      shipping_address: { ...input.address, country_code: "tr" },
      billing_address: { ...input.address, country_code: "tr" },
    },
  })
  if (input.shippingOptionId) {
    await addShippingMethodToCartWorkflow(container).run({
      input: { cart_id: cart.id, options: [{ id: input.shippingOptionId }] },
    })
  }
  const { result: collection } = await createPaymentCollectionForCartWorkflow(container).run({
    input: { cart_id: cart.id },
  })
  await createPaymentSessionsWorkflow(container).run({
    input: { payment_collection_id: collection.id, provider_id: SYSTEM_PAYMENT_PROVIDER_ID },
  })
  await input.beforeComplete?.(cart.id)
  const { result } = await completeCartWorkflow(container).run({ input: { id: cart.id } })
  return result.id
}
