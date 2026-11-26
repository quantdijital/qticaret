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
    /** For the purchase event (docs/20): the item as the backend's server events name it. */
    variant_id?: string | null
    /** The line's product, for its page (`productPathsOf`); a product gone since reads as text. */
    product_id?: string | null
    product_title?: string | null
    unit_price?: number | null
    /** A gift card line's recipient (`qt_gift`) and issued cards' last four (`qt_gift_cards`). */
    metadata?: Record<string, unknown> | null
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
  "items.variant_id",
  "items.product_id",
  "items.product_title",
  "items.unit_price",
  "items.metadata",
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

/**
 * Whether the order is a retail order, for its purchase event's amounts
 * (ADR-0068 §7, slice 5 review L2): asked of the order, so a page opened
 * signed out knows a wholesale order too. Only the backend's plain "not
 * wholesale" is a yes: a wholesale order, or no answer, a network
 * failure included, is a no (the safe way: the event goes without
 * amounts, and the confirmation page still shows).
 */
export async function orderSoldAtRetail(id: string, token: string | null): Promise<boolean> {
  try {
    const { wholesale } = await storeCall<{ wholesale?: unknown }>(
      `/store/orders/${encodeURIComponent(id)}/wholesale`,
      token ? { headers: { "x-order-token": token } } : {}
    )
    return wholesale === false
  } catch {
    return false
  }
}

export interface ReturnRequestRow {
  kind: string
  status: string
  return_code: string | null
  /**
   * The carrier the code is said at ("Aras Kargo"): the shop's contracted
   * return code (adr/0031 Ek 2026-11-26); absent or null for an old
   * request's own code.
   */
  return_carrier?: string | null
  created_at: string
  /** The lines asked for: a gift card line's withdrawal reads apart, and counts its cards. */
  items?: { line_item_id: string; quantity: number }[] | null
  /**
   * Units sent back but refused at receipt, never refunded (adr/0032 Ek
   * 2026-11-03): a sealed good opened (`reason: "unsealed"`, MSY md. 15/1-ç).
   */
  refused_items?: { line_item_id: string; quantity: number; reason?: string | null }[] | null
  /**
   * The refund gave the order's shipping back too (MSY md. 12/1). The
   * store route does not answer it today (admin only); read once it does.
   */
  refund_shipping?: boolean | null
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

/** A line as `/store/orders/:id/returnable` gives it: titles, units left, why it is out. */
export interface ReturnableLineRow {
  line_item_id: string
  title: string | null
  variant_title: string | null
  variant_id: string | null
  /** Units still to ask back: shipped less asked; a gift line's cards, within its period. */
  returnable: number
  /**
   * This line's own window (a shipped line's from its parcels, a gift
   * line's from its cards); the order's `window_open` when left out.
   */
  window_open?: boolean
  /** Why it is shut: `not_yet`, `expired`, `order_canceled`; null while open. */
  window_closed_reason?: string | null
  /** Outside the right of withdrawal: back only as faulty or wrong; a spent gift card not at all. */
  withdrawal_excluded: boolean
  /** `product`, `personal_addon` or `gift_card_used`; null inside the right. */
  withdrawal_excluded_reason: string | null
  /**
   * Inside the right with a condition: `sealed_goods`, back only with its
   * seal unopened (MSY md. 15/1-ç; adr/0032 Ek 2026-11-03); null otherwise.
   */
  withdrawal_warning?: string | null
  /** A gift card line: withdrawn on its own, its cards voided, nothing sent back. */
  gift_card: boolean
  /** The product's other variants, to exchange the line for. */
  variants: { id: string; title: string | null }[]
}

/** What the order may still ask back (adr/0025, 2026-11-03), by the rules a request meets. */
export interface ReturnableRow {
  /** Some line's window is open; false once cancelled. Each line says its own. */
  window_open: boolean
  /** A request is open already: a new one waits for it. */
  open_request: boolean
  /** Whether the shopper may cancel the order, by the cancel's own rule; left out by an older backend. */
  cancellable?: boolean
  /**
   * Why not: `orders.cancel_contact_shop` (money taken by hand),
   * `orders.gift_card_used`, `orders.cancel_after_packing`, `orders.canceled`.
   */
  cancel_refusal?: string | null
  lines: ReturnableLineRow[]
}

/**
 * What the order may ask back, as the backend counts it, fresh on every
 * page (never cached); null when the backend will not say.
 */
export async function orderReturnable(
  id: string,
  token: string | null
): Promise<ReturnableRow | null> {
  try {
    return await storeCall<ReturnableRow>(
      `/store/orders/${encodeURIComponent(id)}/returnable`,
      token ? { headers: { "x-order-token": token } } : {}
    )
  } catch (error) {
    if (isStoreApiError(error)) {
      return null
    }
    throw error
  }
}

/** A parcel that left, as `/store/orders/:id/shipments` gives it. */
export interface ShipmentRow {
  carrier: string | null
  tracking_number: string | null
  tracking_url: string | null
  shipped_at: string | null
  delivered_at: string | null
  status: string | null
  status_at: string | null
  items: { title: string; quantity: number }[]
}

export async function orderShipments(id: string, token: string | null): Promise<ShipmentRow[]> {
  try {
    const { shipments } = await storeCall<{ shipments: ShipmentRow[] }>(
      `/store/orders/${encodeURIComponent(id)}/shipments`,
      token ? { headers: { "x-order-token": token } } : {}
    )
    return shipments
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
