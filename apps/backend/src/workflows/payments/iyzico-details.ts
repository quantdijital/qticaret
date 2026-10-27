import { isProviderError } from "../../lib/errors"
import { errorSummary, logger } from "../../lib/logging"
import { iyzicoApi, parseIyzicoPrice } from "../../lib/payments/iyzico"
import type { IyzicoCredentials } from "../../lib/payments/iyzico"
import type { HostedPaymentDetails } from "./payment-details"

const lira = (value: string | number | undefined) =>
  value === undefined ? null : parseIyzicoPrice(value)

/**
 * An iyzico payment as iyzico holds it now (its payment detail), with the
 * refunds we made from the payment's data: iyzico lists none (F5 V10).
 */
export async function iyzicoDetails(
  account: IyzicoCredentials | null,
  payment: { id: string; data?: Record<string, unknown> | null },
  base: HostedPaymentDetails
): Promise<HostedPaymentDetails> {
  const reference =
    typeof payment.data?.["payment_id"] === "string" ? payment.data["payment_id"] : null
  if (!account || !reference) {
    return { ...base, reference, error_code: account ? "reference_missing" : "not_configured" }
  }
  const records = Array.isArray(payment.data?.["refunds"])
    ? (payment.data["refunds"] as { reference_no: string; amount: number }[])
    : []
  try {
    const detail = await iyzicoApi().paymentDetail(account, reference)
    return {
      ...base,
      reference,
      available: true,
      amount: lira(detail.price),
      total: lira(detail.paidPrice),
      installments: detail.installment ?? null,
      card_brand: detail.cardAssociation ?? detail.cardFamily ?? null,
      card_last4: detail.lastFourDigits ?? null,
      payment_type: detail.cardType ?? null,
      fraud_status: detail.fraudStatus ?? null,
      refunds: records.map((record) => ({
        amount: record.amount,
        date: null,
        reference: record.reference_no,
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
