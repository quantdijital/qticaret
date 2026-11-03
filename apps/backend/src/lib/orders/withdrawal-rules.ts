import type { ReturnLine } from "./returns"

/**
 * The right of withdrawal's rules on money and on what may come back, as
 * the Mesafeli Sözleşmeler Yönetmeliği ("MSY") reads since 1.1.2026 (RG
 * 23.8.2022/31932 and 24.5.2025/32909; adr/0032 Ek 2026-11-03, adr/0052
 * Ek 2026-11-03). Pure, so tested on its own.
 */

const DAY = 24 * 60 * 60 * 1000

/** Days the law gives to pay a withdrawal back (MSY md. 12/1). */
export const REFUND_DAYS = 14

/** Staff are told this far in, so the law's 14 days are never passed. */
export const REFUND_ALERT_DAYS = 10

/**
 * What a returnable line warns about: a hygiene good, returnable while its
 * protective seal is unopened (MSY md. 15/1-ç), refused at receipt if not.
 */
export const WITHDRAWAL_WARNINGS = ["sealed_goods"] as const
export type WithdrawalWarning = (typeof WITHDRAWAL_WARNINGS)[number]

/** Why units sent back were refused at receipt: a hygiene good opened (MSY md. 15/1-ç). */
export const REFUSAL_REASONS = ["unsealed"] as const
export type RefusalReason = (typeof REFUSAL_REASONS)[number]

/** Units refused at receipt, and why. */
export type RefusedLine = ReturnLine & { reason: RefusalReason }

/**
 * What a product's own "outside the right of withdrawal" mark (F13.6)
 * means, by the product's kind. The law excludes a digital or service
 * product outright once delivered or performed (md. 15/1-ğ, 15/1-h).
 * A physical product it excludes only once its protective seal is opened
 * (md. 15/1-ç): the request is allowed, the shopper warned, and staff
 * refuse it at receipt if opened. Made to the buyer's wish (md. 15/1-b)
 * is the line's add-on (adr/0052 §8), not this mark.
 */
export function productMarkOf(
  marked: boolean | null | undefined,
  kind: string | null | undefined
): { excluded: boolean; warning: WithdrawalWarning | null } {
  if (!marked) {
    return { excluded: false, warning: null }
  }
  return kind === "digital" || kind === "service"
    ? { excluded: true, warning: null }
    : { excluded: false, warning: "sealed_goods" }
}

/**
 * Whether a return gives the order's outbound shipping back. A withdrawal
 * refunds what the shopper paid for delivery (MSY md. 12/1): so does any
 * return of a line inside the right of withdrawal, whatever reason the
 * shopper picked (no reason is owed), a part of the order too (the
 * lawful default until a lawyer says otherwise; docs/12). Only a return
 * of lines outside the right, back as faulty or wrong (TKHK md. 11), stays
 * the staff's call. Never on a swap (adr/0032 §6), when nothing was
 * accepted, nor twice: an earlier request that gave it back keeps it.
 */
export function shippingRefundDue(input: {
  kind: "return" | "exchange"
  /** Units taken back, sound and damaged. */
  accepted: readonly ReturnLine[]
  /** Lines outside the right of withdrawal. */
  excluded: ReadonlySet<string>
  staff_choice: boolean
  refunded_before: boolean
}): boolean {
  if (input.kind !== "return" || input.refunded_before) {
    return false
  }
  const taken = input.accepted.filter((line) => line.quantity > 0)
  if (taken.length === 0) {
    return false
  }
  return taken.some((line) => !input.excluded.has(line.line_item_id)) || input.staff_choice
}

/** Why units cannot be refused at receipt (an i18n key): only a hygiene good's, opened. */
export function refusalProblem(
  refused: readonly ReturnLine[],
  sealed: ReadonlySet<string>
): string | null {
  return refused.some((line) => !sealed.has(line.line_item_id))
    ? "returns.refusal_not_sealed"
    : null
}

type When = Date | string | null | undefined

const timeOf = (value: When): number | null => {
  if (value === null || value === undefined) {
    return null
  }
  const time = new Date(value).getTime()
  return Number.isNaN(time) ? null : time
}

/**
 * When the money is due by law: 14 days from the parcel's handover to the
 * return carrier the shop named, or from its arrival when the carrier's
 * handover is not known (sent another way, MSY md. 12/1). Null while
 * neither happened.
 */
export function refundDueAt(request: { handed_over_at?: When; received_at?: When }): Date | null {
  const from = timeOf(request.handed_over_at) ?? timeOf(request.received_at)
  return from === null ? null : new Date(from + REFUND_DAYS * DAY)
}

/** Whether staff are to be told: the 10th day since the clock started has passed. */
export function refundDeadlineNear(
  request: { handed_over_at?: When; received_at?: When },
  now: Date
): boolean {
  const due = refundDueAt(request)
  return due !== null && now.getTime() >= due.getTime() - (REFUND_DAYS - REFUND_ALERT_DAYS) * DAY
}
