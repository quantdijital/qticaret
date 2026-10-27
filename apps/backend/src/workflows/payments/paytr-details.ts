import { isProviderError } from "../../lib/errors"
import { errorSummary, logger } from "../../lib/logging"
import { paytrApi } from "../../lib/payments/paytr"
import type { PaytrCredentials } from "../../lib/payments/paytr"
import type { HostedPaymentDetails } from "./payment-details"

/** A PayTR payment as PayTR holds it now (its status query), refunds included (F5 V7). */
export async function paytrDetails(
  account: PaytrCredentials | null,
  paymentId: string,
  base: HostedPaymentDetails
): Promise<HostedPaymentDetails> {
  const { reference } = base
  if (!account || !reference) {
    return { ...base, error_code: account ? "reference_missing" : "not_configured" }
  }
  try {
    const paid = await paytrApi().queryStatus(account, reference)
    if (!paid) {
      return { ...base, error_code: "payment_not_found" }
    }
    return {
      ...base,
      available: true,
      test_mode: paid.testMode,
      amount: paid.paymentAmount,
      total: paid.totalAmount,
      installments: paid.installments,
      card_brand: paid.cardBrand,
      card_last4: paid.cardLast4,
      payment_type: paid.paymentType,
      refunds: paid.refunds.map((refund) => ({
        amount: refund.amount,
        date: refund.date,
        reference: refund.referenceNo,
      })),
    }
  } catch (error) {
    logger.warn({ event: "paytr.payment_details_failed", paymentId, err: errorSummary(error) })
    return { ...base, error_code: isProviderError(error) ? error.providerCode : "error" }
  }
}
