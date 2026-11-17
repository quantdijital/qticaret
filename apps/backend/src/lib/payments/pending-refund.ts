import type { RefundPaymentInput } from "@medusajs/framework/types"
import { fromMedusaAmount } from "../money"
import type { Kurus } from "../money"

/**
 * The reference our refund workflow chose for the refund under way (the
 * panel's key for the request), when it is for this amount: Medusa gives
 * every try of a refund a new key of its own (F5 V5).
 */
export function pendingReferenceOf(
  data: Record<string, unknown> | undefined,
  amount: Kurus
): string | undefined {
  const pending = data?.["pending_refund"] as
    { reference_no?: unknown; amount?: unknown } | undefined
  return pending?.amount === amount && typeof pending.reference_no === "string"
    ? pending.reference_no
    : undefined
}

/** A refund a provider recorded in the payment's data: the reference it went under, kuruş. */
export interface RefundRecord {
  reference_no: string
  amount: number
  /** Medusa's refund it went with (its key for the provider call), when recorded since 2026-11-17. */
  refund_id?: string
}

export const refundRecordsOf = (
  data: Record<string, unknown> | null | undefined
): RefundRecord[] => (Array.isArray(data?.["refunds"]) ? (data["refunds"] as RefundRecord[]) : [])

// As PayTR takes a reference: letters and digits, at most 64
const providerForm = (reference: string) => reference.replace(/[^A-Za-z0-9]/g, "").slice(0, 64)

/**
 * Whether the payment's data records a refund of `amount` kuruş under our
 * order refund's `reference`, as sent or as PayTR takes it. Medusa writes
 * the data a provider returns only once the refund went through, along
 * with its own refund record (2.21.2 `refundPaymentFromProvider_`):
 * recorded, the money left and Medusa knows it; only our ledger can lag.
 * Another amount under the reference is not this refund (review D5).
 */
export function refundRecorded(
  data: Record<string, unknown> | null | undefined,
  reference: string,
  amount: number
): boolean {
  return refundRecordOf(data, reference, amount) !== undefined
}

/** The record itself (`refundRecorded`): its Medusa refund names the order money move to mend. */
export function refundRecordOf(
  data: Record<string, unknown> | null | undefined,
  reference: string,
  amount: number
): RefundRecord | undefined {
  const forms = new Set([reference, providerForm(reference)])
  return refundRecordsOf(data).find(
    (record) => forms.has(record.reference_no) && record.amount === amount
  )
}

/**
 * The payment's data with the refund recorded under `reference` (once), for
 * a provider that keeps no record of its own we can read back (iyzico, the
 * shop's own transfer or cash): the ledger then knows the refund went
 * through even when a later step failed (`refundRecorded`).
 */
export function withRefundRecord(
  data: Record<string, unknown> | undefined,
  reference: string,
  amount: Kurus,
  refundId?: string
): Record<string, unknown> {
  const records = refundRecordsOf(data)
  const record = { reference_no: reference, amount, ...(refundId ? { refund_id: refundId } : {}) }
  return records.some((each) => each.reference_no === reference)
    ? { ...data }
    : { ...data, refunds: [...records, record] }
}

/**
 * A refund the shop makes by hand (its own transfer, cash at the door):
 * nothing is sent anywhere, the payment's data records our order refund's
 * reference; Medusa's own refund (none named) leaves the data as it is.
 */
export function recordedRefund(input: RefundPaymentInput): Record<string, unknown> {
  const data = input.data ?? {}
  const amount = fromMedusaAmount(input.amount, { allowRounding: true })
  const reference = pendingReferenceOf(data, amount)
  return reference
    ? withRefundRecord(data, reference, amount, input.context?.idempotency_key)
    : { ...data }
}
