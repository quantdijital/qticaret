import type { OptionView, ReturnableLineView, Translate, WithdrawalExclusion } from "@qticaret/ui"
import type { ReturnRequestRow, StoreOrder } from "@/lib/orders/order"
import { lineAddonsOf } from "./addons"
import { orderGiftOf } from "./order-gift"

/*
 * What the order page offers to send back and how it words the requests
 * made (F7.9, adr/0032). A gift card line (adr/0025, 2026-11-03) is never
 * shipped: once its cards went out it may be withdrawn from, on its own and
 * as money back, its cards voided. The backend decides again every time.
 */

const REASONS = ["damaged", "wrong_item", "not_as_described", "changed_mind", "size_issue", "other"]
// The shop's fault: what a line outside the right of withdrawal comes back for (backend `DEFECT_REASONS`)
export const DEFECT_REASONS = ["damaged", "wrong_item", "not_as_described"]
const SHIPPED = new Set(["shipped", "partially_shipped", "delivered", "partially_delivered"])
// Requests whose lines count against what is left (backend `COUNTED_RETURN_STATUSES`)
const COUNTED = new Set(["requested", "approved", "received", "refunded"])

export const returnReasonsOf = (t: Translate): OptionView[] =>
  REASONS.map((reason) => ({ value: reason, label: t(`order.reason_${reason}`) }))

/** A gift card line is withdrawn from on the right of withdrawal alone: no fault reason gets round a spent card. */
export const giftReasonsOf = (t: Translate): OptionView[] => [
  { value: "changed_mind", label: t("order.reason_withdrawal") },
]

/** The order's gift card lines, by id (their record says so: `qt_gift`, `qt_gift_cards`). */
export const giftLinesOf = (order: StoreOrder): Set<string> =>
  new Set(order.items.filter((line) => orderGiftOf(line.metadata)).map((line) => line.id))

/** Whether a gift card line's cards already went out: the order is withdrawn from, not cancelled. */
export const giftCardsSent = (order: StoreOrder): boolean =>
  order.items.some((line) => (orderGiftOf(line.metadata)?.cards.length ?? 0) > 0)

/**
 * Under a line on the return form, in words: why it is outside the right
 * of withdrawal (the backend's `withdrawal_excluded_reason`), or what a
 * gift line's withdrawal does. Null for a plain line.
 */
export function returnNoteOf(
  excluded: WithdrawalExclusion | null,
  gift: boolean,
  t: Translate
): string | null {
  switch (excluded) {
    case "gift_card_used":
      return t("order.return_gift_used")
    case "product":
    case "personal_addon":
      return t("order.return_non_withdrawable")
    case null:
      return gift ? t("order.return_gift_note") : null
  }
}

/** Units each line was asked back for by the requests that count (a withdrawal receives what it asked). */
function askedOf(returns: readonly ReturnRequestRow[]): Map<string, number> {
  const asked = new Map<string, number>()
  for (const request of returns.filter((each) => COUNTED.has(each.status))) {
    for (const line of request.items ?? []) {
      asked.set(line.line_item_id, (asked.get(line.line_item_id) ?? 0) + line.quantity)
    }
  }
  return asked
}

/**
 * The lines the order page offers to send back; null when none: a shipped
 * order's lines, and each gift card line's cards that went out and were not
 * asked back yet, whatever the parcels. `reasons`: why lines are outside the
 * right of withdrawal as the backend says (`withdrawal_excluded_reason`, by
 * line id); a line's own record says `personal_addon` (adr/0052 §8).
 */
export function returnableOf(
  order: StoreOrder,
  returns: readonly ReturnRequestRow[],
  t: Translate,
  reasons: ReadonlyMap<string, WithdrawalExclusion> = new Map()
): ReturnableLineView[] | null {
  if (order.status === "canceled") {
    return null
  }
  const shipped = SHIPPED.has(order.fulfillment_status)
  const asked = askedOf(returns)
  const lines = order.items.flatMap((line): ReturnableLineView[] => {
    const gift = orderGiftOf(line.metadata)
    const excluded =
      reasons.get(line.id) ??
      (lineAddonsOf(line.metadata).nonWithdrawable ? "personal_addon" : null)
    const row = (quantity: number) => ({
      id: line.id,
      title: line.title,
      quantity,
      excluded,
      gift: gift !== null,
      note: returnNoteOf(excluded, gift !== null, t),
    })
    if (!gift) {
      return shipped ? [row(line.quantity)] : []
    }
    // A spent card's line stays, saying why it cannot come back
    if (excluded === "gift_card_used") {
      return gift.cards.length > 0 ? [row(0)] : []
    }
    const left = gift.cards.length - (asked.get(line.id) ?? 0)
    return left > 0 ? [row(left)] : []
  })
  return lines.length > 0 ? lines : null
}

/** A status in words, the first of `keys` that has some; one without words shows as it is. */
function wordOf(t: Translate, keys: string[], value: string): string {
  for (const key of keys) {
    const text = t(key)
    if (text !== key) {
      return text
    }
  }
  return value
}

/**
 * A request's kind and state in words. A gift card withdrawal sends no
 * parcel: once the shop accepts it its cards are voided and the money goes
 * back (`received` while the refund is being made, then `refunded`).
 */
export function requestWordsOf(
  request: ReturnRequestRow,
  giftLines: ReadonlySet<string>,
  t: Translate
): { kind: string; status: string; code: string | null } {
  const items = request.items ?? []
  const gift = items.length > 0 && items.every((line) => giftLines.has(line.line_item_id))
  if (gift) {
    return {
      kind: t("order.return_kind_gift"),
      status: wordOf(
        t,
        [`order.return_gift_status_${request.status}`, `order.return_status_${request.status}`],
        request.status
      ),
      code: null,
    }
  }
  return {
    kind: wordOf(t, [`order.return_kind_${request.kind}`], request.kind),
    status: wordOf(t, [`order.return_status_${request.status}`], request.status),
    code: request.return_code,
  }
}
