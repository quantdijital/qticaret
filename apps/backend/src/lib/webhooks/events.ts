import type { ApiScope } from "../api-access/scopes"

/**
 * The events a shop's own systems can subscribe to (F11.7, adr/0039 §7):
 * orders, stock and returns. A body names records and numbers, never a
 * person: no name, address, e-mail or phone.
 */
export const WEBHOOK_EVENTS = [
  "order.placed",
  "order.canceled",
  "order.fulfilled",
  "return.requested",
  "return.received",
  "stock.changed",
  // F8 (adr/0034 §9): an invoice for the shop's own program to issue and write back
  "invoice.requested",
  "invoice.withdrawn",
] as const
export type WebhookEvent = (typeof WEBHOOK_EVENTS)[number]

/**
 * The read scope a key needs to subscribe to an event (F11.6): a webhook is
 * another way to read the same orders and stock, so it is not a way around
 * `orders:read` or `catalog:read`. Staff subscribe to any.
 */
export const EVENT_SCOPES: Readonly<Record<WebhookEvent, ApiScope>> = {
  "order.placed": "orders:read",
  "order.canceled": "orders:read",
  "order.fulfilled": "orders:read",
  "return.requested": "orders:read",
  "return.received": "orders:read",
  "stock.changed": "catalog:read",
  "invoice.requested": "invoices:read",
  "invoice.withdrawn": "invoices:read",
}
