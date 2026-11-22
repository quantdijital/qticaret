import type {
  OptionView,
  ReturnableLineView,
  Translate,
  WithdrawalExclusion,
  WithdrawalWarning,
} from "@qticaret/ui"
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
 * money back, its cards voided. A sealed good is chosen like any other
 * line, warned that an opened one is refused at receipt (adr/0032 Ek
 * 2026-11-03). The backend decides again every time.
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
// What a line inside the right warns of (backend `WITHDRAWAL_WARNINGS`)
const WARNINGS: readonly string[] = ["sealed_goods"] satisfies WithdrawalWarning[]
// The most units a request takes per line (the Server Action's own bound)
const MAX_UNITS = 999

/**
 * Who pays to send goods back: the shop, always (backend
 * `returns.return_shipping`, adr/0032 Ek 2026-11-03; MSY md. 12/5, md. 13/3
 * repealed). Said once, on the shipped lines' form; a gift card's
 * withdrawal sends nothing.
 */
export const returnShippingNoteOf = (t: Translate): string => t("order.return_shipping_free")

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

// The refusals the shopper can act on, said where the cancel button would be (tr.json keys)
const CANCEL_NOTES: ReadonlySet<string> = new Set([
  "orders.cancel_contact_shop",
  "orders.gift_card_used",
  // A paid dated order: its departures are cancelled one by one, below (adr/0076 Ek D7a)
  "booking.use_booking_cancel",
])

/**
 * Whether the page offers the cancel (F7.13): the backend's answer by the
 * cancel's own rule (`cancellable`), and in words why not when the shopper
 * can act on it (money taken by hand goes back through the shop; a gift
 * card it sent was used). An older backend that does not say: before
 * packing, no gift card it sent used. The backend decides again.
 */
export function cancelOf(
  found: ReturnableRow | null,
  order: Pick<StoreOrder, "status" | "fulfillment_status">,
  t: Translate
): { cancellable: boolean; cancelNote: string | null } {
  if (typeof found?.cancellable === "boolean") {
    const refusal = found.cancel_refusal ?? null
    return {
      cancellable: found.cancellable,
      cancelNote: refusal && CANCEL_NOTES.has(refusal) ? t(refusal) : null,
    }
  }
  return {
    cancellable:
      order.status === "pending" &&
      order.fulfillment_status === "not_fulfilled" &&
      !giftCardUsed(found),
    cancelNote: null,
  }
}

const isExclusion = (reason: string | null): reason is WithdrawalExclusion =>
  reason !== null && EXCLUSIONS.includes(reason)

/** A line's reason as the backend gives it; one this storefront does not know reads as the product's own mark. */
const exclusionOf = (line: ReturnableLineRow): WithdrawalExclusion | null =>
  isExclusion(line.withdrawal_excluded_reason)
    ? line.withdrawal_excluded_reason
    : line.withdrawal_excluded
      ? "product"
      : null

const isWarning = (value: string): value is WithdrawalWarning => WARNINGS.includes(value)

/**
 * A line's warning as the backend gives it; one this storefront does not
 * know reads as a sealed good's, the only condition the right carries.
 */
const warningOf = ({ withdrawal_warning: value }: ReturnableLineRow): WithdrawalWarning | null =>
  value ? (isWarning(value) ? value : "sealed_goods") : null

/**
 * Under a line on the return form, in words: why it is outside the right
 * of withdrawal (the backend's `withdrawal_excluded_reason`), what its
 * warning means (`withdrawal_warning`), or what a gift line's withdrawal
 * does. Null for a plain line.
 */
export function returnNoteOf(
  excluded: WithdrawalExclusion | null,
  gift: boolean,
  t: Translate,
  warning: WithdrawalWarning | null = null
): string | null {
  switch (excluded) {
    case "gift_card_used":
      return t("order.return_gift_used")
    case "product":
    case "personal_addon":
      return t("order.return_non_withdrawable")
    case null:
      return gift
        ? t("order.return_gift_note")
        : warning === "sealed_goods"
          ? t("order.return_sealed_goods")
          : null
  }
}

/**
 * The lines the order page offers to send back, as the backend counts them
 * (`found`); null when none may be, every window is shut (once cancelled
 * too), a request is open already (the shop decides it first: the
 * requests list shows it) or the backend did not say. A line inside its
 * own window (`window_open` per line: a shipped line's from its parcels,
 * a gift line's from its cards) with units left is offered, a sealed
 * good's with its warning, with the variants an exchange may go for; a
 * gift line whose cards were spent stays, with nothing to choose, saying why.
 */
export function returnableOf(
  found: ReturnableRow | null,
  order: StoreOrder,
  t: Translate
): ReturnableLineView[] | null {
  if (!found?.window_open || found.open_request) {
    return null
  }
  const titles = new Map(order.items.map((line) => [line.id, line.title]))
  const lines = found.lines.flatMap((line): ReturnableLineView[] => {
    // An older backend says the order's window only
    if (line.window_open === false) {
      return []
    }
    const excluded = exclusionOf(line)
    // Outside the right, a line has no condition to warn of
    const warning = excluded === null && !line.gift_card ? warningOf(line) : null
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
        warning,
        gift: line.gift_card,
        note: returnNoteOf(excluded, line.gift_card, t, warning),
        // A gift line and one outside the right of withdrawal are never exchanged
        variants:
          line.gift_card || excluded !== null
            ? []
            : line.variants.flatMap((variant) =>
                variant.title ? [{ value: variant.id, label: variant.title }] : []
              ),
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
 * back (`received` while the refund is being made, then `refunded`). A
 * refund that gave the order's shipping back says so, when the backend
 * tells (`refund_shipping`, MSY md. 12/1; the store route does not yet).
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
  const status = `order.return_status_${request.status}`
  return {
    kind: wordOf(t, [`order.return_kind_${request.kind}`], request.kind),
    status: wordOf(
      t,
      request.refund_shipping === true ? [`${status}_shipping`, status] : [status],
      request.status
    ),
    code: request.return_code,
  }
}

/**
 * The units refused at receipt, a line each in words (adr/0032 Ek
 * 2026-11-03): a sealed good opened was not refunded. Named by the order's
 * own line; a reason this storefront does not know says only that it was
 * not taken back.
 */
export function refusedOf(
  request: ReturnRequestRow,
  titles: ReadonlyMap<string, string>,
  t: Translate
): string[] {
  return (request.refused_items ?? []).flatMap((line) =>
    line.quantity > 0
      ? [
          t(line.reason === "unsealed" ? "order.return_refused_unsealed" : "order.return_refused", {
            title: titles.get(line.line_item_id) ?? t("order.line_unnamed"),
            quantity: line.quantity,
          }),
        ]
      : []
  )
}
