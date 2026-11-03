import type { ReturnLine, ReturnRequest } from "@/features/orders/api/returns"
import { excludedLinesOf } from "@/features/orders/api/returns"

/**
 * What the receive dialog counts (adr/0032, Ek 2026-11-03): of each asked
 * line, the units back sound, back broken and refused (a sealed good
 * opened, MSY md. 15/1-ç), together never more than asked. Pure.
 */
export const COUNT_KEYS = ["sound", "damaged", "refused"] as const
export type CountKey = (typeof COUNT_KEYS)[number]
export type Count = Record<CountKey, number>
export type Counts = Record<string, Count>

export const EMPTY_COUNT: Count = { sound: 0, damaged: 0, refused: 0 }

/** Each asked line all back sound: what usually arrives. */
export const initialCounts = (request: Pick<ReturnRequest, "items">): Counts =>
  Object.fromEntries(
    request.items.map((item) => [item.line_item_id, { ...EMPTY_COUNT, sound: item.quantity }])
  )

/**
 * A line's count with one of its numbers set: kept between 0 and asked,
 * the others giving way when the three would pass what was asked (sound
 * first, so the usual "all sound" bends to what staff type).
 */
export function setCount(current: Count, key: CountKey, value: number, asked: number): Count {
  const own = Math.min(Math.max(Math.trunc(value) || 0, 0), asked)
  const next: Count = { ...current, [key]: own }
  let excess = COUNT_KEYS.reduce((sum, each) => sum + next[each], 0) - asked
  for (const other of COUNT_KEYS) {
    if (other === key || excess <= 0) {
      continue
    }
    const cut = Math.min(excess, next[other])
    next[other] -= cut
    excess -= cut
  }
  return next
}

/** One of the three lists, as the server takes it: lines with units only. */
export const linesOf = (counts: Counts, key: CountKey): ReturnLine[] =>
  Object.entries(counts)
    .map(([line_item_id, count]) => ({ line_item_id, quantity: count[key] }))
    .filter((line) => line.quantity > 0)

/**
 * Whether the order's shipping comes back with this receipt, as the
 * server decides it (`shippingRefundDue`): a return taking back any line
 * inside the right of withdrawal gives it by law ("law", MSY md. 12/1);
 * one taking back only lines outside it leaves it to staff ("choice",
 * TKHK md. 11); nothing taken back, none ("none"). An exchange never.
 * Once per order: the server gives none if an earlier request did.
 */
export type ShippingRule = "law" | "choice" | "none"

export function shippingRule(
  request: Pick<ReturnRequest, "kind" | "items">,
  counts: Counts
): ShippingRule {
  const excluded = excludedLinesOf(request)
  const taken = Object.entries(counts).filter(([, count]) => count.sound + count.damaged > 0)
  if (request.kind !== "return" || taken.length === 0) {
    return "none"
  }
  return taken.some(([id]) => !excluded.has(id)) ? "law" : "choice"
}
