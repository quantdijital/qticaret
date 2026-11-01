import "server-only"
import type { CheckoutAddress } from "../checkout/cart"
import { isStoreApiError } from "../store-api/errors"
import { storeCall } from "../store-api/server"

/** An order as its page shows it (D7), read with the order's key (adr/0037 §2). */
export interface StoreOrder {
  id: string
  display_id: number
  email: string
  created_at: string
  status: string
  payment_status: string
  fulfillment_status: string
  items: {
    title: string
    subtitle: string | null
    variant_title: string | null
    thumbnail: string | null
    quantity: number
    total: number
  }[]
  original_item_total: number
  item_total: number
  shipping_total: number
  total: number
  shipping_address: CheckoutAddress | null
  payment_collections?: { payment_sessions?: { provider_id: string }[] }[]
}

const TOKEN = /^[0-9a-z]{1,12}\.[A-Za-z0-9_-]{43}$/
const ORDER_ID = /^order_[0-9A-Za-z]{10,64}$/

const FIELDS = [
  "id",
  "display_id",
  "email",
  "created_at",
  "status",
  "+payment_status",
  "+fulfillment_status",
  "items.title",
  "items.subtitle",
  "items.variant_title",
  "items.thumbnail",
  "items.quantity",
  "items.total",
  "original_item_total",
  "item_total",
  "shipping_total",
  "total",
  "*shipping_address",
  // Only the provider is read; Medusa answers a relation whole or not at all
  "*payment_collections.payment_sessions",
].join(",")

/**
 * The order with its key, or without one as the signed-in customer's own;
 * null for a wrong id, a wrong or old key, another's order (the backend
 * answers 404 alike).
 */
export async function orderWithToken(id: string, token: string | null): Promise<StoreOrder | null> {
  if (!ORDER_ID.test(id) || (token !== null && !TOKEN.test(token))) {
    return null
  }
  try {
    const { order } = await storeCall<{ order: StoreOrder }>(
      `/store/orders/${encodeURIComponent(id)}`,
      { query: { fields: FIELDS }, ...(token ? { headers: { "x-order-token": token } } : {}) }
    )
    return order
  } catch (error) {
    if (isStoreApiError(error) && (error.status === 404 || error.status === 401)) {
      return null
    }
    throw error
  }
}

/** The way the order is paid, from its payment sessions. */
export function providersOf(order: StoreOrder): string[] {
  return (order.payment_collections ?? []).flatMap((collection) =>
    (collection.payment_sessions ?? []).map((session) => session.provider_id)
  )
}
