import type { Kurus } from "../../lib/money"
import { isHostedFormProvider } from "../../lib/payments/checkout"

/**
 * How a departure's money goes back (adr/0076 Ek D7a and its security
 * follow-ups): which payments count as money taken, whether it goes back
 * on its own or by hand, and the way a cancel gave it back, kept on the
 * use row. Pure.
 */

/**
 * Why the refund is not sent on its own but left to staff (review O1,
 * O2): `offline`, money not taken by a hosted card form (a bank transfer, cash on
 * delivery, an edit's difference) goes back by hand; `credit`, part was
 * paid with a gift card or store credit, which must go back to the card
 * or the account, never turned into cash; `exceeds`, the departure's
 * share is more than the payments still hold.
 */
export type ManualRefund = "offline" | "credit" | "exceeds"

/**
 * The way a cancel gave the departure's money back, kept on its use row
 * (`booking_slot_use.cancel_refund`): `sent` by the provider, `none` due,
 * or left to staff and why. A cancel asked again and the reconcile's bell
 * read it instead of guessing from the order as it is now.
 */
export type CancelRefund = "sent" | "none" | ManualRefund

export const MANUAL_REFUNDS: readonly ManualRefund[] = ["offline", "credit", "exceeds"]

export const isManualRefund = (value: unknown): value is ManualRefund =>
  (MANUAL_REFUNDS as readonly unknown[]).includes(value)

/** The way kept for a cancel's plan: what it sends, leaves to staff, or nothing due. */
export const cancelRefundOf = (plan: {
  refund: Kurus
  manual: ManualRefund | null
}): CancelRefund => plan.manual ?? (plan.refund > 0 ? "sent" : "none")

export interface PaymentRow {
  provider_id?: string | null
  captured_at?: unknown
  canceled_at?: unknown
  captures?: ({ id?: string | null } | null)[] | null
}

export interface PaidOrderRow {
  payment_collections?: ({ payments?: (PaymentRow | null)[] | null } | null)[] | null
}

/** The payment fields `takenPaymentsOf` reads. */
export const TAKEN_PAYMENT_FIELDS = [
  "payment_collections.payments.provider_id",
  "payment_collections.payments.captured_at",
  "payment_collections.payments.canceled_at",
  "payment_collections.payments.captures.id",
]

/**
 * The order's payments money was taken by: not cancelled, and captured in
 * full (`captured_at`) or in part (a capture made). Medusa sets
 * `captured_at` only once the whole amount is in, so a partial capture
 * counts by its captures (refund safety follow-up).
 */
export const takenPaymentsOf = (order: PaidOrderRow | null | undefined): PaymentRow[] =>
  (order?.payment_collections ?? []).flatMap((collection) =>
    (collection?.payments ?? []).filter(
      (payment): payment is PaymentRow =>
        Boolean(payment) &&
        !payment?.canceled_at &&
        (Boolean(payment?.captured_at) || (payment?.captures ?? []).some(Boolean))
    )
  )

/**
 * Whether the money taken goes back by hand (security review of D7a): only
 * one payment taken through a hosted card form (PayTR, iyzico) is refunded
 * on its own; any other way (a bank transfer, cash on delivery, the
 * system provider, one not known yet) or more than one payment is staff's.
 * An allow list: a new way to pay is by hand until named here.
 */
export const takenByHandOf = (
  taken: readonly ({ provider_id?: string | null } | null | undefined)[]
): boolean =>
  taken.length > 1 || taken.some((payment) => !isHostedFormProvider(payment?.provider_id ?? ""))

/**
 * Why the departure's refund is left to staff, null when it is sent
 * (review O1, O2): money taken by hand first, then credit used, then a
 * share above what the payments hold.
 */
export function manualRefundOf(facts: {
  refund: Kurus
  taken_by_hand: boolean
  credit: Kurus
  exceeds: boolean
}): ManualRefund | null {
  if (facts.refund <= 0) {
    return null
  }
  if (facts.taken_by_hand) {
    return "offline"
  }
  if (facts.credit > 0) {
    return "credit"
  }
  return facts.exceeds ? "exceeds" : null
}
