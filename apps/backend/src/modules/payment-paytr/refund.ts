import { ValidationError, isProviderError } from "../../lib/errors"
import { kurus, subtractKurus, sumKurus } from "../../lib/money"
import type { Kurus } from "../../lib/money"
import { paytrApi } from "../../lib/payments/paytr"
import type { PaytrCredentials } from "../../lib/payments/paytr"
import { paytrSession } from "./session"

/** A refund kept in the payment's data: what was given back, under which reference. */
interface RefundRecord {
  reference_no: string
  amount: number
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

/**
 * Gives back `amount` of a PayTR payment under `referenceNo` (adr/0026
 * §9). PayTR is asked first: the payment must be there, in the test mode
 * it was taken in (test keys never refund a live payment), and a refund
 * already made under this reference (an answer lost on the way,
 * `outcome_unknown`) is not made twice. Returns the payment's data with
 * the refund recorded.
 */
export async function refundPaytrPayment(
  account: PaytrCredentials,
  data: Record<string, unknown> | undefined,
  amount: Kurus,
  referenceNo: string
): Promise<Record<string, unknown>> {
  const session = paytrSession(data)
  const paid = await paytrApi().queryStatus(account, session.merchant_oid)
  if (!paid) {
    throw new ValidationError("paytr.payment_not_found")
  }
  if (paid.testMode !== session.test_mode) {
    throw new ValidationError("paytr.test_mode_mismatch")
  }
  if (!paid.refunds.some((refund) => refund.referenceNo === referenceNo)) {
    try {
      await paytrApi().refund(account, { merchantOid: session.merchant_oid, amount, referenceNo })
    } catch (error) {
      if (isProviderError(error) && SHOP_ACTIONABLE.has(error.providerCode)) {
        throw new ValidationError(`paytr.${error.providerCode}`, { cause: error })
      }
      throw error
    }
  }
  const records = recordsOf(data)
  return records.some((record) => record.reference_no === referenceNo)
    ? { ...data }
    : { ...data, refunds: [...records, { reference_no: referenceNo, amount }] }
}

export { pendingReferenceOf } from "../../lib/payments/pending-refund"
