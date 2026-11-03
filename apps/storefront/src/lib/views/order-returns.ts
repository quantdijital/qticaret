import type { OptionView, ReturnableLineView, Translate, WithdrawalExclusion } from "@qticaret/ui"
import type {
  ReturnRequestRow,
  ReturnableLineRow,
  ReturnableRow,
  StoreOrder,
} from "@/lib/orders/order"
import { orderGiftOf } from "./order-gift"

/*
 * What the order page offers to send back and how it words the requests
 * made (F7.9, adr/0032). Which lines may come back, how many units and
 * why a line is out are the backend's (`GET /store/orders/:id/returnable`,
 * adr/0025 2026-11-03): a gift card line is never shipped; once its cards
 * went out it may be withdrawn from within the period, on its own and as
 * money back, its cards voided. The backend decides again every time.
 */

const REASONS = ["damaged", "wrong_item", "not_as_described", "changed_mind", "size_issue", "other"]
// The shop's fault: what a line outside the right of withdrawal comes back for (backend `DEFECT_REASONS`)
export const DEFECT_REASONS = ["damaged", "wrong_item", "not_as_described"]
// Why a line is outside the right of withdrawal (backend `WITHDRAWAL_EXCLUSIONS`)
const EXCLUSIONS: readonly string[] = [
  "product",
  "personal_addon",
  "gift_card_used",
] satisfies WithdrawalExclusion[]
// The most units a request takes per line (the Server Action's own bound)
const MAX_UNITS = 999

export const returnReasonsOf = (t: Translate): OptionView[] =>
  REASONS.map((reason) => ({ value: reason, label: t(`order.reason_${reason}`) }))

/** A gift card line is withdrawn from on the right of withdrawal alone: no fault reason gets round a spent card. */
export const giftReasonsOf = (t: Translate): OptionView[] => [
  { value: "changed_mind", label: t("order.reason_withdrawal") },
]

/**
 * The order's gift card lines, by id: their own record (`qt_gift`,
 * `qt_gift_cards`) and, when it answered, the backend's word (`gift_card`).
 */
export const giftLinesOf = (order: StoreOrder, found: ReturnableRow | null = null): Set<string> =>
  new Set([
    ...order.items.filter((line) => orderGiftOf(line.metadata)).map((line) => line.id),
    ...(found?.lines ?? []).filter((line) => line.gift_card).map((line) => line.line_item_id),
  ])

/**
 * Whether a gift card the order sent was used, as the backend says: the
 * order is then not cancelled (`orders.gift_card_used`); untouched cards
 * are voided with it.
 */
export const giftCardUsed = (found: ReturnableRow | null): boolean =>
  (found?.lines ?? []).some(
    (line) => line.gift_card && line.withdrawal_excluded_reason === "gift_card_used"
  )

const isExclusion = (reason: string | null): reason is WithdrawalExclusion =>
  reason !== null && EXCLUSIONS.includes(reason)

/** A line's reason as the backend gives it; one this storefront does not know reads as the product's own mark. */
const exclusionOf = (line: ReturnableLineRow): WithdrawalExclusion | null =>
  isExclusion(line.withdrawal_excluded_reason)
    ? line.withdrawal_excluded_reason
    : line.withdrawal_excluded
      ? "product"
      : null

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

/**
 * The lines the order page offers to send back, as the backend counts them
 * (`found`); null when none may be, the window is shut (once cancelled
 * too) or the backend did not say. A line with units left is offered; a
 * gift line whose cards were spent stays, with nothing to choose, saying why.
 */
export function returnableOf(
  found: ReturnableRow | null,
  order: StoreOrder,
  t: Translate
): ReturnableLineView[] | null {
  if (!found?.window_open) {
    return null
  }
  const titles = new Map(order.items.map((line) => [line.id, line.title]))
  const lines = found.lines.flatMap((line): ReturnableLineView[] => {
    const excluded = exclusionOf(line)
    const spent = line.gift_card && excluded === "gift_card_used"
    const units = Math.min(Math.trunc(line.returnable), MAX_UNITS)
    if (!spent && !(units > 0)) {
      return []
    }
    return [
      {
        id: line.line_item_id,
        title: line.title ?? titles.get(line.line_item_id) ?? "",
        quantity: spent ? 0 : units,
        excluded,
        gift: line.gift_card,
        note: returnNoteOf(excluded, line.gift_card, t),
      },
    ]
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
