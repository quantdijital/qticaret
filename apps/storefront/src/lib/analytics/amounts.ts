import type { AnalyticsEvent, MetaCall } from "./events"
import { ga4Event, metaEvent } from "./events"

/**
 * A signed-in wholesaler's events (ADR-0068 §7, slice 3 review I2): their
 * prices are theirs alone, agreed with the shop, so no amount of theirs
 * reaches a third party's tag. The event still goes (what was viewed,
 * added, bought: the shop's funnel), without a unit price, a value, a
 * currency or a shipping cost. Meta's purchase needs a value: it is not
 * sent at all (nor is the order's server event, backend `conversions/send.ts`).
 */

/** The event with no line's price. */
function priceless(event: AnalyticsEvent): AnalyticsEvent {
  return "items" in event
    ? { ...event, items: event.items.map((item) => ({ ...item, price: null })) }
    : event
}

/** The keys of a call's data that are amounts. */
const AMOUNTS = new Set(["currency", "value", "shipping"])

const amountless = (data: Record<string, unknown>): Record<string, unknown> =>
  Object.fromEntries(Object.entries(data).filter(([key]) => !AMOUNTS.has(key)))

/** GA4's call for a wholesaler's session: no price, value, currency or shipping. */
export function ga4EventWithoutAmounts(event: AnalyticsEvent): [string, Record<string, unknown>] {
  const [name, params] = ga4Event(priceless(event))
  return [name, amountless(params)]
}

/** Meta's call for a wholesaler's session: no price, value or currency; no purchase. */
export function metaEventWithoutAmounts(event: AnalyticsEvent): MetaCall | null {
  if (event.name === "purchase") {
    return null
  }
  const call = metaEvent(priceless(event))
  if (!call) {
    return null
  }
  return { ...call, data: amountless(call.data) }
}
