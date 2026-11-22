import { allocateCappedKurus, kurus, subtractKurus, sumKurus } from "../../money"
import type { Kurus } from "../../money"
import type { LineShare } from "../../orders/shares"

/**
 * The basket a hosted payment form shows (adr/0026), from the cart's line
 * shares (F4.7): what each line costs after discounts, in kuruş. PayTR and
 * iyzico both read it; iyzico refuses a basket whose lines do not add up
 * to the price (5062) and a line of 0 TL or less (5050).
 * - Store credit and gift cards (the cart's credit lines) are spread over
 *   the lines in proportion to what each costs, never past a line's cost.
 * - A line left at 0 TL is left out: a free item, or one paid by credit.
 * - The lines always add up to `payable`, the payment collection's amount.
 */

export interface BasketLine {
  id: string
  kind: LineShare["kind"]
  name: string
  quantity: number
  /** What the line costs in this payment, for all its quantity. */
  amount: Kurus
  /** False: an item nothing ships for (adr/0076 §6); absent: shipped. */
  ships?: false
}

export class BasketMismatch extends Error {
  constructor(message: string) {
    super(`payment basket: ${message}`)
    this.name = "BasketMismatch"
  }
}

export function paymentBasket(
  lines: readonly (Pick<LineShare, "id" | "kind" | "quantity" | "net"> & {
    name: string
    ships?: boolean
  })[],
  payable: Kurus
): BasketLine[] {
  const total = sumKurus(lines.map((line) => line.net))
  const credit = subtractKurus(total, payable)
  if (payable <= 0 || credit < 0) {
    // More to pay than the lines cost, or nothing: the cart and the collection disagree
    throw new BasketMismatch(`lines total ${String(total)}, payment ${String(payable)}`)
  }
  const credits =
    credit > 0
      ? allocateCappedKurus(
          credit,
          lines.map((line) => line.net),
          lines.map((line) => line.net)
        )
      : lines.map(() => kurus(0))
  return lines
    .map((line, index) => ({
      id: line.id,
      kind: line.kind,
      name: line.name,
      quantity: line.quantity,
      amount: subtractKurus(line.net, credits[index] ?? kurus(0)),
      ...(line.ships === false ? { ships: false as const } : {}),
    }))
    .filter((line) => line.amount > 0)
}
