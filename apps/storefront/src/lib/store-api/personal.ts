/**
 * What the storefront's shared cache (`shared.ts`) must never hold
 * (ADR-0068 §7, slice 3 review I3): an answer of a customer's own routes,
 * and a wholesaler's price (a display marked `vat_exclusive`, which only
 * the personal route makes). Pure: the cache asks before it keeps.
 */

/** A customer's own routes: answered for one session only. */
const PERSONAL_PATH = /^\/store\/customers(\/|$)/

export const isPersonalPath = (path: string): boolean => PERSONAL_PATH.test(path)

/**
 * A price display as `wholesaleDisplay()` makes it: by its shape, not a
 * bare `vat_exclusive` key (a product's own metadata may hold one, review L3).
 */
const isWholesaleDisplay = (record: Record<string, unknown>): boolean =>
  record["vat_exclusive"] === true &&
  typeof record["current"] === "string" &&
  typeof record["gross"] === "string"

/** How many values a scan looks at: a shop-wide answer is a few thousand at most. */
const SCAN_BUDGET = 200_000

/**
 * Whether the answer holds a wholesaler's price anywhere in it (a
 * wholesale display, or the personal route's `wholesale_prices`): `yes`,
 * `no`, or `unknown` past the budget (too large to look through).
 */
export function personalPriceIn(answer: unknown): "yes" | "no" | "unknown" {
  const stack: unknown[] = [answer]
  let seen = 0
  while (stack.length > 0) {
    const value = stack.pop()
    if (++seen > SCAN_BUDGET) {
      return "unknown"
    }
    if (typeof value !== "object" || value === null) {
      continue
    }
    const record = value as Record<string, unknown>
    if (!Array.isArray(value) && (isWholesaleDisplay(record) || "wholesale_prices" in record)) {
      return "yes"
    }
    // One by one: spreading a long list into push() would overflow the call
    for (const each of Array.isArray(value) ? (value as unknown[]) : Object.values(record)) {
      stack.push(each)
    }
  }
  return "no"
}
