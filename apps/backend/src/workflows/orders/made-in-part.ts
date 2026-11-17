import type { MedusaContainer } from "@medusajs/framework/types"
import { ConflictError } from "../../lib/errors"
import { kurus, sumKurus } from "../../lib/money"
import { spreadRefund } from "../../lib/orders/refunds"
import { ORDER_REFUNDS_MODULE } from "../../modules/order-refunds"
import type OrderRefundsModuleService from "../../modules/order-refunds/service"
import type { ProviderPart, RefundLine } from "../../modules/order-refunds/service"

/**
 * A refund iyzico made in part (D4-1, follow-up of PR #153): some of its
 * item-transaction parts answered `done`, the whole amount not reached,
 * and none left without an answer. What iyzico confirmed is the sum of the
 * `done` parts the ledger keeps; nothing the client sends counts.
 */
export interface MadeInPart {
  /** Kuruş iyzico confirmed given back: the `done` parts. */
  done: number
  /** Kuruş of the refund never given back: refundable again under a new reference. */
  remainder: number
}

/**
 * The made part of a refund, or why it has none to settle: a part without
 * an answer (`sending`) may have been made, so it is never counted as not
 * made (`orders.refund_check_part_unknown`); a refund with no part done, or
 * done whole, is not one made in part (`orders.refund_check_not_partial`).
 */
export function madeInPart(amount: number, parts: readonly ProviderPart[]): MadeInPart {
  if (parts.length === 0) {
    throw new ConflictError("orders.refund_check_not_partial")
  }
  if (parts.some((part) => part.state !== "done")) {
    throw new ConflictError("orders.refund_check_part_unknown")
  }
  const done = parts.reduce((sum, part) => sum + part.amount, 0)
  if (!Number.isSafeInteger(done) || done <= 0 || done >= amount) {
    throw new ConflictError("orders.refund_check_not_partial")
  }
  return { done, remainder: amount - done }
}

/**
 * The refund's lines as made: `done` kuruş spread over them by what each
 * was to give back, so the lines add up to the made part and the rest of
 * each line is free for a new refund. Units stay counted: the goods given
 * money back for are not asked back or refunded by units again; the rest
 * goes back as an amount. A refund of no lines (an order made cheaper,
 * `balance`) keeps none.
 */
export function linesMadeInPart(lines: readonly RefundLine[], done: number): RefundLine[] {
  const planned = sumKurus(lines.map((line) => kurus(line.net)))
  const parts = spreadRefund(
    kurus(Math.min(done, planned)),
    lines.map((line) => ({ id: line.id, remaining: kurus(line.net) }))
  )
  return lines
    .map((line, index) => ({ ...line, net: parts[index]?.net ?? 0 }))
    .filter((line) => line.net > 0 || line.quantity > 0)
}

/**
 * The entry rewritten to what was made, still open: its amount the `done`
 * parts, its lines spread to match. Cut short after this, every part is
 * done and adds up to the amount, so the refund reads `shown` and the
 * settling job closes it under its reference, sending nothing (iyzico's
 * provider finds nothing left to send). Under the order's refund lock.
 */
export async function keepMadePart(
  container: Pick<MedusaContainer, "resolve">,
  entry: { id: string; lines?: unknown },
  done: number
): Promise<void> {
  const lines = linesMadeInPart((entry.lines as RefundLine[] | null) ?? [], done)
  await container.resolve<OrderRefundsModuleService>(ORDER_REFUNDS_MODULE).updateOrderRefunds({
    id: entry.id,
    amount: done,
    lines: lines as unknown as Record<string, unknown>,
  })
}
