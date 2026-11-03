import type { ReturnLine, ReturnRequest } from "@/features/orders/api/returns"

/**
 * What a request says of the law's rules on returns (adr/0032 Ek
 * 2026-11-03, MSY md. 12/1 and 15/1-ç), worked out the way the server
 * does, for the queue, the order's card and the receive dialog. Pure.
 */

const DAY = 24 * 60 * 60 * 1000

/**
 * The server rings the bell on the 10th of the law's 14 days
 * (`returns.refund_deadline_near`); from then the day shows red.
 */
export const REFUND_NEAR_DAYS = 4

const units = (lines: readonly ReturnLine[] | null | undefined): number =>
  (lines ?? []).reduce((sum, line) => sum + line.quantity, 0)

/** The request's lines that are sealed goods: refusable at receipt if opened. */
export const sealedLinesOf = (request: Pick<ReturnRequest, "items">): ReadonlySet<string> =>
  new Set(
    request.items
      .filter((item) => item.withdrawal_warning === "sealed_goods")
      .map((item) => item.line_item_id)
  )

/**
 * Received with every unit refused (a sealed good opened): nothing came
 * back to refund, so no refund is offered (the server owes none).
 */
export const allRefused = (
  request: Pick<ReturnRequest, "status" | "received_items" | "damaged_items" | "refused_items">
): boolean =>
  (request.status === "received" || request.status === "refunded") &&
  units(request.refused_items) > 0 &&
  units(request.received_items) + units(request.damaged_items) === 0

export type RefundDeadlineState = "open" | "near" | "late"

export interface RefundDeadline {
  due_at: string
  state: RefundDeadlineState
  /** Whole days left, at least 1 while not late; 0 when late. */
  days_left: number
}

/**
 * The law's last day to pay the return back while money is still owed: a
 * return approved or received with something taken back. "near" within
 * the last 4 days, "late" once past. Null when nothing is owed or the
 * clock has not started (neither handed over nor arrived).
 */
export function refundDeadline(
  request: Pick<
    ReturnRequest,
    "kind" | "status" | "refund_due_at" | "received_items" | "damaged_items" | "refused_items"
  >,
  now: Date = new Date()
): RefundDeadline | null {
  const owed =
    request.kind === "return" &&
    (request.status === "approved" || (request.status === "received" && !allRefused(request)))
  const due = request.refund_due_at ? Date.parse(request.refund_due_at) : Number.NaN
  if (!owed || Number.isNaN(due)) {
    return null
  }
  const left = due - now.getTime()
  if (left <= 0) {
    return { due_at: request.refund_due_at ?? "", state: "late", days_left: 0 }
  }
  const days = Math.ceil(left / DAY)
  return {
    due_at: request.refund_due_at ?? "",
    state: days <= REFUND_NEAR_DAYS ? "near" : "open",
    days_left: days,
  }
}
