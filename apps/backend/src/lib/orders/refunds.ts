import {
  addKurus,
  allocateCappedKurus,
  kurus,
  prorateKurus,
  subtractKurus,
  sumKurus,
} from "../money"
import type { Kurus } from "../money"
import type { LineShare } from "./shares"

/**
 * Partial refunds of a discounted order (F4.7 KK, adr/0010). A unit gives
 * back what its line was paid, never its list price: the line's share of
 * the discount stays out. Units are counted cumulatively (what n units
 * paid, less what the n − 1 before them did), so however a line comes
 * back, one by one or all at once, its refunds add up to its payment to
 * the kuruş and never pass it.
 */

export interface LineRefund {
  id: string
  quantity: number
  /** The units' list price, tax included. */
  gross: Kurus
  /** Their share of the line's discount. */
  discount: Kurus
  /** What they give back. */
  net: Kurus
}

/** What a line's first `units` units paid; all of them paid the line's payment. */
export const paidForUnits = (line: LineShare, units: number): Kurus =>
  line.quantity === 0 ? kurus(0) : prorateKurus(line.net, units, line.quantity)

const counted = (amount: Kurus, line: LineShare, before: number, units: number): Kurus =>
  subtractKurus(
    prorateKurus(amount, before + units, line.quantity),
    prorateKurus(amount, before, line.quantity)
  )

/**
 * What `units` more units of a line give back, `before` of its units
 * having come back already. A line priced in whole kuruş per unit (as
 * prices are entered) gives each unit its own price, and the discount is
 * what the payment leaves of it, never below zero. Otherwise (a price
 * with tax added on, say) the discount is counted like the payment.
 */
export function unitsRefund(line: LineShare, before: number, units: number): LineRefund {
  const counts = [before, units]
  if (!counts.every((count) => Number.isSafeInteger(count) && count >= 0)) {
    throw new RangeError("unit counts must be whole and not negative")
  }
  if (before + units > line.quantity) {
    throw new RangeError("cannot give back more units than the line holds")
  }
  if (units === 0) {
    return { id: line.id, quantity: 0, gross: kurus(0), discount: kurus(0), net: kurus(0) }
  }
  const net = counted(line.net, line, before, units)
  const discount =
    line.gross % line.quantity === 0
      ? subtractKurus(kurus((line.gross / line.quantity) * units), net)
      : counted(line.discount, line, before, units)
  return { id: line.id, quantity: units, gross: addKurus(net, discount), discount, net }
}

export interface ReturnedUnits {
  id: string
  quantity: number
}

/**
 * What a return gives back: each line's units after those that came back
 * before (`returned`, by line id). Shipping is not part of it; whether a
 * shop refunds it is the return's own decision.
 */
export function returnRefund(
  shares: readonly LineShare[],
  returned: ReadonlyMap<string, number>,
  items: readonly ReturnedUnits[]
): { lines: LineRefund[]; total: Kurus } {
  // A line named twice comes back once, with both counts
  const wanted = new Map<string, number>()
  for (const item of items) {
    wanted.set(item.id, (wanted.get(item.id) ?? 0) + item.quantity)
  }
  const lines = [...wanted].map(([id, quantity]) => {
    const line = shares.find((share) => share.id === id && share.kind === "item")
    if (!line) {
      throw new RangeError(`no item line ${id} on the order`)
    }
    return unitsRefund(line, returned.get(id) ?? 0, quantity)
  })
  return { lines, total: sumKurus(lines.map((line) => line.net)) }
}

/**
 * A refund of a free amount (a goodwill gesture, a price corrected after
 * the sale) spread over lines by what each still holds: its payment less
 * what was refunded on it. No line gives back more than it holds, so a
 * provider that refunds line by line never refuses one.
 */
export function spreadRefund(
  amount: Kurus,
  lines: readonly { id: string; remaining: Kurus }[]
): { id: string; net: Kurus }[] {
  const remaining = lines.map((line) => line.remaining)
  const parts = allocateCappedKurus(amount, remaining, remaining)
  return lines.map((line, index) => ({ id: line.id, net: parts[index] ?? kurus(0) }))
}
