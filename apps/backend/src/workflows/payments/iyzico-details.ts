import { isProviderError } from "../../lib/errors"
import { errorSummary, logger } from "../../lib/logging"
import { iyzicoApi, parseIyzicoPrice } from "../../lib/payments/iyzico"
import type { IyzicoCredentials } from "../../lib/payments/iyzico"
import type { HostedPaymentDetails } from "./payment-details"

const kurusOrNull = (value: string | number | undefined) =>
  value === undefined ? null : parseIyzicoPrice(value)

/**
 * An iyzico payment as iyzico holds it now (its payment detail), with the
 * refunds from our ledger: iyzico lists none (F5 V10).
 */
export async function iyzicoDetails(
  account: IyzicoCredentials | null,
  payment: { id: string; data?: Record<string, unknown> | null },
  base: HostedPaymentDetails,
  /** Our refunds of this payment (`order-refunds`): iyzico lists none. */
  ledger: readonly {
    reference: string
    amount: number
    status: string
    created_at: Date | string
  }[]
): Promise<HostedPaymentDetails> {
  const reference =
    typeof payment.data?.["payment_id"] === "string" ? payment.data["payment_id"] : null
  if (!account || !reference) {
    return { ...base, reference, error_code: account ? "reference_missing" : "not_configured" }
  }
  try {
    const detail = await iyzicoApi().paymentDetail(account, reference)
    return {
      ...base,
      reference,
      available: true,
      amount: kurusOrNull(detail.price),
      total: kurusOrNull(detail.paidPrice),
      installments: detail.installment ?? null,
      card_brand: detail.cardAssociation ?? detail.cardFamily ?? null,
      card_last4: detail.lastFourDigits ?? null,
      payment_type: detail.cardType ?? null,
      fraud_status: detail.fraudStatus ?? null,
      refunds: ledger
        .filter((refund) => refund.status !== "failed")
        .map((refund) => ({
          amount: refund.amount,
          date: new Date(refund.created_at).toISOString(),
          reference: refund.reference,
        })),
    }
  } catch (error) {
    logger.warn({
      event: "iyzico.payment_details_failed",
      paymentId: payment.id,
      err: errorSummary(error),
    })
    return { ...base, reference, error_code: isProviderError(error) ? error.providerCode : "error" }
  }
}
