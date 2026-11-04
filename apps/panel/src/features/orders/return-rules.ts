import { DEFECT_REASONS } from "@/features/orders/api/returns"
import type { OpenRequest, Returnable } from "@/features/orders/api/returnable"
import type { ReturnReason, ReturnRequest } from "@/features/orders/api/returns"
import { soldAsGiftCard } from "@/features/orders/gift-lines"

type Line = Returnable["lines"][number]

/**
 * Why a request opened for the shopper would be refused, said before it is
 * sent, by the server's own order of rules (`requestReturn`): a gift card
 * line goes in a request of its own and only as money back
 * (`returns.gift_card_separate`), never once a card of it was spent
 * (`returns.gift_card_used`); a line outside the right of withdrawal is
 * never exchanged and comes back only as faulty or wrong. Null: none.
 */
export type RequestProblem = "giftSeparate" | "giftUsed" | "excludedExchange" | "excludedReason"

export function requestProblem(
  chosen: readonly Line[],
  kind: OpenRequest["kind"],
  reason: ReturnReason | ""
): RequestProblem | null {
  const gifts = chosen.filter((line) => line.gift_card)
  if (gifts.length > 0 && (gifts.length !== chosen.length || kind === "exchange")) {
    return "giftSeparate"
  }
  if (chosen.some((line) => line.withdrawal_excluded_reason === "gift_card_used")) {
    return "giftUsed"
  }
  if (!chosen.some((line) => line.withdrawal_excluded)) {
    return null
  }
  if (kind === "exchange") {
    return "excludedExchange"
  }
  return reason !== "" && !DEFECT_REASONS.includes(reason) ? "excludedReason" : null
}

/** The order's gift card lines by id, from the lines' metadata (`returnLinesQuery`). */
export const giftLineIds = (
  lines: readonly ({ id: string; metadata?: unknown } | null | undefined)[] | null | undefined
): ReadonlySet<string> =>
  new Set((lines ?? []).flatMap((line) => (line && soldAsGiftCard(line.metadata) ? [line.id] : [])))

/**
 * A request asking back gift card lines alone: approving it voids the
 * cards and refunds at once, nothing to wait for (adr/0025 Ek 2026-11-03).
 * A line marked by the request itself counts; otherwise the order's lines.
 */
export function isGiftRequest(
  request: { kind: OpenRequest["kind"]; items: { line_item_id: string; gift_card?: boolean }[] },
  gifts: ReadonlySet<string> = new Set()
): boolean {
  return (
    request.kind === "return" &&
    request.items.length > 0 &&
    request.items.every((item) => item.gift_card === true || gifts.has(item.line_item_id))
  )
}

/**
 * Whether an approved request can still be taken back (order #691): its
 * parcel not handed to the carrier, and for an exchange nothing collected
 * from the shopper. The server checks again (`returns.cancel_*`).
 */
export const requestCancellable = (
  request: Pick<ReturnRequest, "status" | "kind" | "difference" | "handed_over_at">
): boolean =>
  request.status === "approved" &&
  !request.handed_over_at &&
  !(request.kind === "exchange" && Number(request.difference ?? 0) > 0)
