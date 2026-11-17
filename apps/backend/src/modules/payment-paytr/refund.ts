import { ValidationError, isProviderError } from "../../lib/errors"
import { kurus, subtractKurus, sumKurus } from "../../lib/money"
import type { Kurus } from "../../lib/money"
import { paytrApi } from "../../lib/payments/paytr"
import type { PaytrCredentials } from "../../lib/payments/paytr"
import { NEVER_LEFT, markRefused } from "../../lib/payments/refund-refusal"
import { paytrSession } from "./session"

/** A refund kept in the payment's data: what was given back, under which reference. */
interface RefundRecord {
  reference_no: string
  amount: number
  /** Medusa's refund it went with, when Medusa named one. */
  refund_id?: string
}

// PayTR's answers the shop can act on, as messages; the rest stay provider errors
const SHOP_ACTIONABLE = new Set([
  "refund_locked",
  "refund_exceeds_payment",
  "payment_not_notified",
  "refund_not_supported",
  "balance_insufficient",
  "payment_too_old",
])

const recordsOf = (data: Record<string, unknown> | undefined): RefundRecord[] =>
  Array.isArray(data?.["refunds"]) ? (data["refunds"] as RefundRecord[]) : []

/** What is left of the payment to give back: what was paid, less our recorded refunds. */
export function refundableOf(data: Record<string, unknown> | undefined): Kurus {
  const { amount } = paytrSession(data)
  return subtractKurus(
    kurus(amount),
    sumKurus(recordsOf(data).map((refund) => kurus(refund.amount)))
  )
}

/** PayTR takes a refund reference of letters and digits, at most 64. */
export const refundReferenceOf = (key: string): string =>
  key.replace(/[^A-Za-z0-9]/g, "").slice(0, 64)

// `M<merchant_oid>A<kuruş>N<k>`, at most 64 letters and digits: a long reference loses the
// end of its merchant_oid, never its amount or count (PayTR lists refunds per payment)
const ownReference = (merchantOid: string, amount: Kurus, nth: number): string => {
  const tail = `A${String(amount)}N${String(nth)}`
  return refundReferenceOf(`M${merchantOid}`).slice(0, 64 - tail.length) + tail
}

/**
 * The reference of a refund Medusa asks for on its own (no order refund
 * named one: its cart completion's give-back, its refund route). Medusa
 * gives each try a new key; this one is the payment's, the amount's and
 * its count's: the first of this amount the payment's data does not record
 * yet. A retried step (the data not yet written) finds its refund at PayTR
 * under the same reference and never sends another; a second refund of
 * the same amount, once the first is recorded, is a new one and is sent.
 */
export function ownRefundReferenceOf(
  merchantOid: string,
  amount: Kurus,
  data: Record<string, unknown> | undefined
): string {
  const recorded = new Set(recordsOf(data).map((record) => record.reference_no))
  let nth = 1
  while (recorded.has(ownReference(merchantOid, amount, nth))) {
    nth += 1
  }
  return ownReference(merchantOid, amount, nth)
}

const sendRefund = async (
  account: PaytrCredentials,
  input: { merchantOid: string; amount: Kurus; referenceNo: string }
): Promise<void> => {
  try {
    await paytrApi().refund(account, input)
  } catch (error) {
    if (isProviderError(error) && SHOP_ACTIONABLE.has(error.providerCode)) {
      throw new ValidationError(`paytr.${error.providerCode}`, { cause: error })
    }
    // A call that never left gave nothing back either; any other failure may hide a refund
    throw isProviderError(error) && NEVER_LEFT.has(error.providerCode) ? markRefused(error) : error
  }
}

/**
 * Gives back `amount` of a PayTR payment under `referenceNo` (adr/0026
 * §9), once. A refund our data records under it already is not asked
 * about again (our order refund's reference names one request). Else
 * PayTR is asked first: the payment must be there, in the test mode it
 * was taken in (test keys never refund a live payment), and a refund
 * PayTR shows under this reference (an answer lost on the way,
 * `outcome_unknown`), or of this amount under one of `sameAs` our data
 * does not record yet (the same money given back another way: the
 * recovery job's), is not made again but recorded. A new refund is sent
 * only while what PayTR and our data show given back, with it, stays
 * within what was paid: parts of different amounts all go, never more
 * than the payment. Returns the payment's data with the refund recorded,
 * under Medusa's refund (`refundId`) when it names one: our ledger finds
 * that refund's order money move by it (review D-3).
 */
export async function refundPaytrPayment(
  account: PaytrCredentials,
  data: Record<string, unknown> | undefined,
  amount: Kurus,
  referenceNo: string,
  sameAs: readonly string[] = [],
  refundId?: string
): Promise<Record<string, unknown>> {
  const records = recordsOf(data)
  if (records.some((record) => record.reference_no === referenceNo)) {
    return { ...data }
  }
  const session = paytrSession(data)
  const paid = await paytrApi().queryStatus(account, session.merchant_oid)
  if (!paid) {
    throw new ValidationError("paytr.payment_not_found")
  }
  if (paid.testMode !== session.test_mode) {
    throw new ValidationError("paytr.test_mode_mismatch")
  }
  // One PayTR refund answers one record at most: one our data holds already proves no new one
  const recorded = new Set(records.map((record) => record.reference_no))
  const made =
    paid.refunds.find((refund) => refund.referenceNo === referenceNo) ??
    paid.refunds.find(
      (refund) =>
        refund.referenceNo !== null &&
        !recorded.has(refund.referenceNo) &&
        sameAs.includes(refund.referenceNo) &&
        refund.amount === amount
    )
  const recordedAs = made?.referenceNo ?? referenceNo
  if (!made) {
    const given = Math.max(
      sumKurus(paid.refunds.map((refund) => refund.amount)),
      sumKurus(records.map((record) => kurus(record.amount)))
    )
    // PayTR refuses it too (`009`); refused here it is never sent at all
    if (given + amount > paid.paymentAmount) {
      throw new ValidationError("paytr.refund_exceeds_payment")
    }
    await sendRefund(account, { merchantOid: session.merchant_oid, amount, referenceNo })
  }
  return records.some((record) => record.reference_no === recordedAs)
    ? { ...data }
    : {
        ...data,
        refunds: [
          ...records,
          { reference_no: recordedAs, amount, ...(refundId ? { refund_id: refundId } : {}) },
        ],
      }
}

export { pendingReferenceOf } from "../../lib/payments/pending-refund"
