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
] as const
export type WebhookEvent = (typeof WEBHOOK_EVENTS)[number]
