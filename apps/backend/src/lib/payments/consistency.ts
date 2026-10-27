import { fromMedusaAmount } from "../money"
import type { MedusaAmount } from "../money"
import { isCheckoutProvider } from "./checkout"

/**
 * Whether a cart's payment still matches the cart (security review,
 * 2026-10-27): a session started while the cart changed can survive at the
 * old amount, and a provider compares what it took with the session only.
 * The cart's total, its collection and every live session must agree to
 * the kuruş; a hosted form's own record of the amount too.
 */

const LIVE = new Set([
  "pending",
  "requires_more",
  "authorized",
  "captured",
  "pending_authorization",
])

type Amount = MedusaAmount | null | undefined

export interface PaymentFacts {
  raw_total?: Amount
  total?: Amount
  payment_collection?: {
    raw_amount?: Amount
    amount?: Amount
    payment_sessions?:
      | ({
          provider_id?: string | null
          status?: string | null
          raw_amount?: Amount
          amount?: Amount
          data?: Record<string, unknown> | null
        } | null)[]
      | null
  } | null
}

// The stored decimal where Query gives it, the number otherwise (nested rows may lack `raw_`)
const kurusOf = (raw: Amount, plain?: Amount) => {
  const amount = raw ?? plain
  return amount === null || amount === undefined
    ? null
    : fromMedusaAmount(amount, { allowRounding: true })
}

export function paymentMismatch(cart: PaymentFacts): boolean {
  const collection = cart.payment_collection
  if (!collection) {
    return false
  }
  const amount = kurusOf(collection.raw_amount, collection.amount)
  if (amount === null || amount !== kurusOf(cart.raw_total, cart.total)) {
    return true
  }
  return (collection.payment_sessions ?? []).some((session) => {
    if (!session || !LIVE.has(session.status ?? "")) {
      return false
    }
    if (kurusOf(session.raw_amount, session.amount) !== amount) {
      return true
    }
    // Every session ours keeps the amount it was started for (adr/0026, adr/0029)
    return isCheckoutProvider(session.provider_id) && session.data?.["amount"] !== amount
  })
}

/** Whether a cart to be paid has no live session, or one our route did not start (adr/0026, adr/0029). */
export function paidOutsideCheckout(cart: PaymentFacts): boolean {
  const collection = cart.payment_collection
  if (!collection || (kurusOf(collection.raw_amount, collection.amount) ?? 0) === 0) {
    return false
  }
  const live = (collection.payment_sessions ?? []).filter(
    (session) => session && LIVE.has(session.status ?? "")
  )
  return live.length === 0 || !live.every((session) => isCheckoutProvider(session?.provider_id))
}

export const PAYMENT_FACT_FIELDS = [
  "total",
  "raw_total",
  "payment_collection.amount",
  "payment_collection.raw_amount",
  "payment_collection.payment_sessions.provider_id",
  "payment_collection.payment_sessions.status",
  "payment_collection.payment_sessions.amount",
  "payment_collection.payment_sessions.raw_amount",
  "payment_collection.payment_sessions.data",
]
