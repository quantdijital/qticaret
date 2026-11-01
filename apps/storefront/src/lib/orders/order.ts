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
    id: string
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
  "items.id",
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

export interface ReturnRequestRow {
  kind: string
  status: string
  return_code: string | null
  created_at: string
}

/** The shopper's return requests on the order (F7.9); none when the backend will not say. */
export async function orderReturns(id: string, token: string | null): Promise<ReturnRequestRow[]> {
  try {
    const { return_requests } = await storeCall<{ return_requests: ReturnRequestRow[] }>(
      `/store/orders/${encodeURIComponent(id)}/returns`,
      token ? { headers: { "x-order-token": token } } : {}
    )
    return return_requests
  } catch (error) {
    if (isStoreApiError(error)) {
      return []
    }
    throw error
  }
}

export interface InvoiceRow {
  id: string
  number: string | null
  has_pdf: boolean
}

/** The order's invoice (F8), when one is issued. */
export async function orderInvoice(id: string, token: string | null): Promise<InvoiceRow | null> {
  try {
    const { invoice } = await storeCall<{ invoice: InvoiceRow | null }>(
      `/store/orders/${encodeURIComponent(id)}/invoice`,
      token ? { headers: { "x-order-token": token } } : {}
    )
    return invoice
  } catch (error) {
    if (isStoreApiError(error)) {
      return null
    }
    throw error
  }
}

/** Which of the order's contracts the backend kept (accepted at checkout). */
export async function orderContractKinds(
  id: string,
  token: string | null
): Promise<("pre_information" | "distance_sales")[]> {
  const kinds = ["pre_information", "distance_sales"] as const
  const found = await Promise.all(
    kinds.map(async (kind) => {
      try {
        await storeCall(`/store/orders/${encodeURIComponent(id)}/legal/${kind}`, {
          ...(token ? { headers: { "x-order-token": token } } : {}),
        })
        return kind
      } catch (error) {
        if (isStoreApiError(error)) {
          return null
        }
        throw error
      }
    })
  )
  return found.filter((kind) => kind !== null)
}
