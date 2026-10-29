import { createHash } from "node:crypto"
import { normalizeTrPhone } from "../tr/phone"

/**
 * Server-side conversion events (F10.9, adr/0038 §4): an order as Meta's
 * Conversions API and GA4's Measurement Protocol read it, checked against
 * their documentation. Built only from what the shopper consented to: the
 * caller decides; here nothing is sent and nothing is logged.
 */

/** An order's facts for its events, in lira. */
export interface ConversionOrder {
  id: string
  email: string | null
  phone: string | null
  createdAt: Date
  total: number
  shipping: number
  items: { id: string; title: string; price: number; quantity: number }[]
}

/** What the storefront captured with the shopper's consent. */
export interface ConversionClient {
  ip: string | null
  userAgent: string | null
  fbp: string | null
  fbc: string | null
  pageUrl: string | null
}

const sha256 = (value: string): string => createHash("sha256").update(value).digest("hex")

/** An address as Meta matches it: trimmed, in lower case, hashed with SHA-256. */
export const metaEmail = (email: string): string => sha256(email.trim().toLowerCase())

/** A phone as Meta matches it: digits with the country code, hashed; null when it is none. */
export function metaPhone(phone: string): string | null {
  const normalized = normalizeTrPhone(phone)
  return normalized ? sha256(normalized.replace(/\D/g, "")) : null
}

const amount = (value: number): number => Math.round(value * 100) / 100

/**
 * The order as Meta's `Purchase`: its id is the event id, so the browser
 * pixel's event for the same order counts once. The address and phone go
 * hashed; the IP address, the browser and Meta's cookies as they are,
 * as Meta asks.
 */
export function metaPurchase(order: ConversionOrder, client: ConversionClient) {
  const phone = order.phone ? metaPhone(order.phone) : null
  return {
    event_name: "Purchase",
    event_time: Math.floor(order.createdAt.getTime() / 1000),
    event_id: order.id,
    action_source: "website",
    ...(client.pageUrl ? { event_source_url: client.pageUrl } : {}),
    user_data: {
      ...(order.email ? { em: [metaEmail(order.email)] } : {}),
      ...(phone ? { ph: [phone] } : {}),
      ...(client.ip ? { client_ip_address: client.ip } : {}),
      ...(client.userAgent ? { client_user_agent: client.userAgent } : {}),
      ...(client.fbp ? { fbp: client.fbp } : {}),
      ...(client.fbc ? { fbc: client.fbc } : {}),
    },
    custom_data: {
      currency: "TRY",
      value: amount(order.total),
      content_type: "product",
      content_ids: order.items.map((item) => item.id),
      contents: order.items.map((item) => ({
        id: item.id,
        quantity: item.quantity,
        item_price: amount(item.price),
      })),
      num_items: order.items.reduce((sum, item) => sum + item.quantity, 0),
      order_id: order.id,
    },
  }
}

/** The order as GA4's `purchase`, its id the transaction id. */
export function ga4Purchase(order: ConversionOrder) {
  return {
    name: "purchase",
    params: {
      currency: "TRY",
      value: amount(order.total),
      transaction_id: order.id,
      shipping: amount(order.shipping),
      items: order.items.map((item) => ({
        item_id: item.id,
        item_name: item.title,
        price: amount(item.price),
        quantity: item.quantity,
      })),
    },
  }
}

/** A refund of the order as GA4's `refund`: its amount, against the same transaction. */
export function ga4Refund(orderId: string, value: number) {
  return {
    name: "refund",
    params: { currency: "TRY", transaction_id: orderId, value: amount(value) },
  }
}
