import type { AnalyticsEvent, AnalyticsItem } from "./events"
import { itemsValue } from "./events"

/**
 * The cart as the frame last showed it (D9): its id, whether it is a
 * payment link's (adr/0051, its lines the shop's), and its items by
 * variant, each at the unit price the server gave the line (its total
 * after discounts over its quantity). No cart: `id` null.
 */
export interface CartSnapshot {
  id: string | null
  locked: boolean
  items: AnalyticsItem[]
}

export const NO_CART: CartSnapshot = { id: null, locked: false, items: [] }

/**
 * What changed between two looks at the cart, as `add_to_cart` and
 * `remove_from_cart` (theme-agnostic: whatever form changed the cart,
 * the product page's, a card's quick add, the drawer's or the cart
 * page's). A unit added is priced as the cart prices it now, one taken
 * out as it was priced. Nothing when there is no earlier look, the cart
 * is another one (a restored or a payment link's cart, never "added"),
 * a payment link's, or gone (an order placed empties nothing).
 */
export function cartChanges(
  before: CartSnapshot | undefined,
  after: CartSnapshot
): AnalyticsEvent[] {
  if (!before || after.id === null || before.locked || after.locked) {
    return []
  }
  if (before.id !== null && before.id !== after.id) {
    return []
  }
  const had = new Map(before.items.map((item) => [item.id, item]))
  const has = new Map(after.items.map((item) => [item.id, item]))
  const added: AnalyticsItem[] = []
  const removed: AnalyticsItem[] = []
  for (const item of after.items) {
    const more = item.quantity - (had.get(item.id)?.quantity ?? 0)
    if (more > 0) {
      added.push({ ...item, quantity: more })
    }
  }
  for (const item of before.items) {
    const fewer = item.quantity - (has.get(item.id)?.quantity ?? 0)
    if (fewer > 0) {
      removed.push({ ...item, quantity: fewer })
    }
  }
  return [
    ...(added.length > 0
      ? [{ name: "add_to_cart" as const, value: itemsValue(added), items: added }]
      : []),
    ...(removed.length > 0
      ? [{ name: "remove_from_cart" as const, value: itemsValue(removed), items: removed }]
      : []),
  ]
}

/** A snapshot as kept in the browser, read back: anything malformed is no earlier look. */
export function snapshotOf(raw: unknown): CartSnapshot | undefined {
  if (typeof raw !== "object" || raw === null) {
    return undefined
  }
  const { id, locked, items } = raw as Record<string, unknown>
  if (typeof id !== "string" || typeof locked !== "boolean" || !Array.isArray(items)) {
    return undefined
  }
  const valid = items.every(
    (item: unknown) =>
      typeof item === "object" &&
      item !== null &&
      typeof (item as AnalyticsItem).id === "string" &&
      typeof (item as AnalyticsItem).name === "string" &&
      typeof (item as AnalyticsItem).quantity === "number" &&
      ((item as AnalyticsItem).price === null || typeof (item as AnalyticsItem).price === "number")
  )
  return valid ? { id, locked, items: items as AnalyticsItem[] } : undefined
}
