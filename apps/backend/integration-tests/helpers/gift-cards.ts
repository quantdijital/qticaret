import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import {
  addShippingMethodToCartWorkflow,
  completeCartWorkflow,
  createCartWorkflow,
  createPaymentCollectionForCartWorkflow,
  createPaymentSessionsWorkflow,
} from "@medusajs/medusa/core-flows"
import { SYSTEM_PAYMENT_PROVIDER_ID } from "../../src/scripts/bootstrap/constants"
import type { StockShop } from "./stock"

/** F4.8: carts paid partly or wholly with gift cards and store credit. */

const ADDRESS = { first_name: "Ayşe", last_name: "Yılmaz", address_1: "Demo", country_code: "tr" }

/** One unit of `variantId` with the shop's shipping (90), for a customer or a guest. */
export async function shippedCart(
  container: MedusaContainer,
  shop: StockShop,
  variantId: string,
  customerId?: string
): Promise<string> {
  const { result } = await createCartWorkflow(container).run({
    input: {
      region_id: shop.regionId,
      sales_channel_id: shop.salesChannelId,
      currency_code: "try",
      items: [{ variant_id: variantId, quantity: 1 }],
      shipping_address: ADDRESS,
      billing_address: ADDRESS,
      ...(customerId ? { customer_id: customerId } : {}),
    },
  })
  await addShippingMethodToCartWorkflow(container).run({
    input: { cart_id: result.id, options: [{ id: shop.shippingOptionId }] },
  })
  return result.id
}

/** Checkout as a shopper does it; a basket the credit covers whole needs no payment. */
export async function checkout(
  container: MedusaContainer,
  cartId: string
): Promise<{ orderId: string; paid: number }> {
  const { result: collection } = await createPaymentCollectionForCartWorkflow(container).run({
    input: { cart_id: cartId },
  })
  if (Number(collection.amount) > 0) {
    await createPaymentSessionsWorkflow(container).run({
      input: { payment_collection_id: collection.id, provider_id: SYSTEM_PAYMENT_PROVIDER_ID },
    })
  }
  const { result } = await completeCartWorkflow(container).run({ input: { id: cartId } })
  return { orderId: result.id, paid: Number(collection.amount) }
}

/** A card's credit as the plugin works it out (not in the generated types). */
export async function cardAccount(
  container: MedusaContainer,
  cardId: string
): Promise<{ balance: number; debits: number }> {
  const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "gift_card",
    fields: ["store_credit_account.balance", "store_credit_account.debits"],
    filters: { id: cardId },
  })
  return (data[0] as unknown as { store_credit_account: { balance: number; debits: number } })
    .store_credit_account
}
