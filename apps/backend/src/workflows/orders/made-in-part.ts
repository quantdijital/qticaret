import type { MedusaContainer } from "@medusajs/framework/types"
import { ConflictError } from "../../lib/errors"
import { logger } from "../../lib/logging"
import { kurus, sumKurus } from "../../lib/money"
import { spreadRefund } from "../../lib/orders/refunds"
import { ORDER_REFUNDS_MODULE } from "../../modules/order-refunds"
import type OrderRefundsModuleService from "../../modules/order-refunds/service"
import type { ProviderPart, RefundLine } from "../../modules/order-refunds/service"
import { assertRecordable, recordMadeRefund } from "./made-refund-record"
import type { LedgerEntry } from "./refund-settle"
import { dropPendingRefund } from "./steps/pending-refund"
import { restoreRefundTransaction } from "./steps/refund-transactions"

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

/** A refund staff closed at the part iyzico made: kept on the entry once it is done. */
export const CHECKED_MADE_IN_PART = "checked_made_in_part"

/**
 * Only the panel's own refunds (its key: 32 hex digits) are closed in part
 * (review D4-1, S1). A cancel's, a return's or an edit's refund is its
 * flow's: tried again under its reference, a refund closed in part would
 * read done at the made part, and the flow would take that for the whole.
 */
export const PANEL_REFUND_KEY = /^[0-9a-f]{32}$/

/**
 * The entry rewritten to what was made, still open, marked so (review
 * D4-1, L1): its amount the `done` parts, its lines spread to match. Cut
 * short after this, every part is done and adds up to the amount, so the
 * refund reads `shown` and the settling job closes it under its reference,
 * sending nothing (iyzico's provider finds nothing left to send) and
 * keeping the mark. Under the order's refund lock.
 */
export async function keepMadePart(
  container: Pick<MedusaContainer, "resolve">,
  entry: { id: string; lines?: unknown },
  done: number,
  parts?: readonly ProviderPart[]
): Promise<void> {
  const lines = linesMadeInPart((entry.lines as RefundLine[] | null) ?? [], done)
  await container.resolve<OrderRefundsModuleService>(ORDER_REFUNDS_MODULE).updateOrderRefunds({
    id: entry.id,
    amount: done,
    lines: lines as unknown as Record<string, unknown>,
    error_code: CHECKED_MADE_IN_PART,
    // A lost part staff answered for, written with the rest: never one without the other
    ...(parts ? { provider_parts: parts as unknown as Record<string, unknown> } : {}),
  })
}

/**
 * The parts once staff said what became of the one whose answer was lost
 * (review D4-1, M2): seen given back in iyzico's panel, it is done; not
 * seen, it is taken off, as a part iyzico refused. At most one is ever
 * left so: a refund stops at its first part without an answer, and no
 * refund of the payment is sent while one is.
 */
export function resolveLostPart(
  parts: readonly ProviderPart[],
  answer: "made" | "not_made"
): ProviderPart[] {
  return answer === "made"
    ? parts.map((part) => ({ ...part, state: "done" as const }))
    : parts.filter((part) => part.state === "done")
}

/**
 * An iyzico refund made in part, closed by staff as made in part (D4-1):
 * Medusa's refund record and the order's money move for exactly the parts
 * iyzico answered `done` (read from the ledger, never from the request),
 * the entry closed at that amount, its lines spread to match; the rest is
 * refunded anew under a new reference. Any part without an answer is
 * refused: it may have been made. Sends nothing. In this order: the entry
 * rewritten (cut short, it reads `shown` and the job closes it), Medusa's
 * record (`recordMadeRefund`: one, by its note), the money move, the name
 * off the payment, the entry closed.
 */
export async function settleMadeInPart(
  container: Pick<MedusaContainer, "resolve">,
  entry: LedgerEntry & { lines?: unknown },
  parts: readonly ProviderPart[],
  actorId: string,
  lostPart?: "made" | "not_made"
): Promise<{ reference: string; status: "done" }> {
  const ledger = container.resolve<OrderRefundsModuleService>(ORDER_REFUNDS_MODULE)
  // A cancel's, a return's or an edit's refund: its own flow sends what is left (S1, M1)
  if (!PANEL_REFUND_KEY.test(entry.reference)) {
    throw new ConflictError("orders.refund_in_part_flow_owned")
  }
  const { done, remainder } = madeInPart(entry.amount, parts)
  // Past what the payment can give back: refused before the entry is touched
  await assertRecordable(container, entry.payment_id, done)
  // A lost part's answer written with the rewrite (M2), never apart from it
  await keepMadePart(container, entry, done, lostPart ? parts : undefined)
  const made = { ...entry, amount: done }
  await recordMadeRefund(container, made, actorId)
  await restoreRefundTransaction(container, made)
  await dropPendingRefund(container, entry.payment_id)
  await ledger.updateOrderRefunds({
    id: entry.id,
    status: "done",
    error_code: CHECKED_MADE_IN_PART,
  })
  logger.info({
    event: "orders.refund_checked",
    orderId: entry.order_id,
    reference: entry.reference,
    outcome: "made_in_part",
    done,
    remainder,
    ...(lostPart ? { lostPart } : {}),
  })
  return { reference: entry.reference, status: "done" }
}
