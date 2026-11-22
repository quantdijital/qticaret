import { ValidationError } from "../errors"
import { kurus, prorateKurus, subtractKurus, sumKurus } from "../money"
import type { Kurus } from "../money"
import { spreadRefund, unitsRefund } from "./refunds"
import type { LineShare } from "./shares"

/**
 * A money refund planned line by line (F5 V5, adr/0010), from the order's
 * shares and what its refunds already gave back. Units are counted after
 * those refunded before; no line gives back more units than it holds nor
 * more than it was paid, so a free amount refunded earlier lowers what its
 * units give later. Messages are i18n keys.
 */

export interface RefundRequest {
  items?: readonly { id: string; quantity: number }[]
  /** The shipping lines' remainder too. */
  shipping?: boolean
  /** A free amount, spread over the lines by what each still holds. */
  amount?: Kurus
  /**
   * What the order no longer costs after an edit or a swap made it cheaper
   * (adr/0033, adr/0032 §6): its lines already say so, so it is booked
   * against none of them; only what was paid caps it.
   */
  balance?: Kurus
  /**
   * With `items`: the share of their money the shop keeps, 0–100 (a
   * dated line cancelled under its tier, adr/0076 §8): each line gives
   * back its units less this share, rounded half up to the kuruş. Set by
   * the server from the tier, never by a request.
   */
  fee_percent?: number
}

export interface PlannedLine {
  id: string
  kind: LineShare["kind"]
  quantity: number
  net: Kurus
}

export interface Refunded {
  units: ReadonlyMap<string, number>
  net: ReadonlyMap<string, number>
}

const remainingOf = (line: LineShare, refunded: Refunded): Kurus =>
  kurus(Math.max(subtractKurus(line.net, kurus(refunded.net.get(line.id) ?? 0)), 0))

function itemLines(
  shares: readonly LineShare[],
  refunded: Refunded,
  items: NonNullable<RefundRequest["items"]>,
  feePercent = 0
): PlannedLine[] {
  if (!Number.isInteger(feePercent) || feePercent < 0 || feePercent > 100) {
    throw new RangeError("a fee is a whole percent from 0 to 100")
  }
  // A line named twice gives back both counts, once
  const wanted = new Map<string, number>()
  for (const item of items) {
    wanted.set(item.id, (wanted.get(item.id) ?? 0) + item.quantity)
  }
  return [...wanted].map(([id, quantity]) => {
    const line = shares.find((share) => share.id === id && share.kind === "item")
    if (!line) {
      throw new ValidationError("orders.refund_line_unknown", { field: "items" })
    }
    const before = refunded.units.get(id) ?? 0
    if (before + quantity > line.quantity) {
      throw new ValidationError("orders.refund_units_exceeded", { field: "items" })
    }
    const { net } = unitsRefund(line, before, quantity)
    const paid = kurus(Math.min(net, remainingOf(line, refunded)))
    return {
      id,
      kind: line.kind,
      quantity,
      net: subtractKurus(paid, prorateKurus(paid, feePercent, 100)),
    }
  })
}

export function planRefund(
  shares: readonly LineShare[],
  refunded: Refunded,
  request: RefundRequest,
  refundable: Kurus
): { lines: PlannedLine[]; total: Kurus } {
  let lines: PlannedLine[]
  if (request.balance !== undefined) {
    if (request.balance <= 0) {
      throw new ValidationError("orders.refund_empty")
    }
    if (request.balance > refundable) {
      throw new ValidationError("orders.refund_exceeds_paid", { field: "amount" })
    }
    return { lines: [], total: request.balance }
  }
  if (request.amount !== undefined) {
    const open = shares
      .map((line) => ({ line, remaining: remainingOf(line, refunded) }))
      .filter(({ remaining }) => remaining > 0)
    if (request.amount > sumKurus(open.map(({ remaining }) => remaining))) {
      throw new ValidationError("orders.refund_exceeds_paid", { field: "amount" })
    }
    const parts = spreadRefund(
      request.amount,
      open.map(({ line, remaining }) => ({ id: line.id, remaining }))
    )
    lines = open.map(({ line }, index) => ({
      id: line.id,
      kind: line.kind,
      quantity: 0,
      net: parts[index]?.net ?? kurus(0),
    }))
  } else {
    lines = [
      ...itemLines(shares, refunded, request.items ?? [], request.fee_percent),
      ...(request.shipping
        ? shares
            .filter((line) => line.kind === "shipping")
            .map((line) => ({
              id: line.id,
              kind: line.kind,
              quantity: 0,
              net: remainingOf(line, refunded),
            }))
        : []),
    ]
  }
  lines = lines.filter((line) => line.net > 0 || line.quantity > 0)
  const total = sumKurus(lines.map((line) => line.net))
  if (total <= 0) {
    throw new ValidationError("orders.refund_empty")
  }
  if (total > refundable) {
    throw new ValidationError("orders.refund_exceeds_paid", { field: "amount" })
  }
  return { lines, total }
}
