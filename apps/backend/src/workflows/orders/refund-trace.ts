import type { MedusaContainer } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import { errorSummary, logger } from "../../lib/logging"
import { PAYTR_PAYMENT_PROVIDER_ID } from "../../lib/payments/checkout"
import { refundRecorded } from "../../lib/payments/pending-refund"
import { paytrApi, paytrCredentialsOf } from "../../lib/payments/paytr"
import { INTEGRATION_CREDENTIALS_MODULE } from "../../modules/integration-credentials"
import type IntegrationCredentialsModuleService from "../../modules/integration-credentials/service"

/**
 * What became of an order refund's money, its ledger entry not closed
 * (review 2026-11-17):
 * - `made`: the payment's data records it, this amount under this
 *   reference: the provider gave it back and Medusa recorded its refund.
 * - `shown`: the provider shows it given back (PayTR's `returns[]`, every
 *   iyzico part answered) though our data does not: the same reference
 *   records it without sending again.
 * - `partial`: iyzico parts were sent, not all answered or not the whole.
 * - `unknown`: the payment or the provider could not be read.
 * - `none`: read, and nothing shows it; at PayTR not yet proof (its
 *   record can lag a lost answer), elsewhere nothing was sent.
 */
export type RefundTrace = "made" | "shown" | "partial" | "unknown" | "none"

export interface TracedRefund {
  reference: string
  payment_id: string
  /** Kuruş. */
  amount: number
  /** Parts a provider refunding in parts sent (iyzico, `provider_parts`). */
  parts: readonly { amount: number; state: string }[]
}

// As our PayTR provider sends a reference: letters and digits, at most 64
const paytrForm = (reference: string) => reference.replace(/[^A-Za-z0-9]/g, "").slice(0, 64)

/**
 * What PayTR's record says of the refund. Unreadable (no account, no
 * reference to ask by, or a refund of this amount PayTR lists with no
 * reference, which ours always carry: one made by hand, or ours under
 * another form) is `unknown`, never `none` (review D-2).
 */
const paytrTrace = async (
  container: Pick<MedusaContainer, "resolve">,
  data: Record<string, unknown> | null | undefined,
  entry: TracedRefund
): Promise<RefundTrace> => {
  const account = paytrCredentialsOf(
    await container
      .resolve<IntegrationCredentialsModuleService>(INTEGRATION_CREDENTIALS_MODULE)
      .read("paytr")
  )
  const merchantOid = data?.["merchant_oid"]
  if (!account || typeof merchantOid !== "string") {
    return "unknown"
  }
  const paid = await paytrApi().queryStatus(account, merchantOid)
  const sentAs = paytrForm(entry.reference)
  const refunds = paid?.refunds ?? []
  if (refunds.some((refund) => refund.referenceNo === sentAs && refund.amount === entry.amount)) {
    return "shown"
  }
  return refunds.some((refund) => refund.referenceNo === null && refund.amount === entry.amount)
    ? "unknown"
    : "none"
}

const partsTrace = (entry: TracedRefund): RefundTrace => {
  const whole = entry.parts.reduce((sum, part) => sum + part.amount, 0) === entry.amount
  return whole && entry.parts.every((part) => part.state === "done") ? "shown" : "partial"
}

/** The refund's trace, read when its entry would fail, by a cancel, and by the settling job. */
export async function refundTraceOf(
  container: Pick<MedusaContainer, "resolve">,
  entry: TracedRefund
): Promise<{ trace: RefundTrace; provider: string }> {
  let provider = "unknown"
  try {
    const [payment] = await container
      .resolve(Modules.PAYMENT)
      .listPayments({ id: entry.payment_id }, { select: ["id", "provider_id", "data"] })
    provider = providerNameOf(payment?.provider_id)
    if (refundRecorded(payment?.data, entry.reference, entry.amount)) {
      return { trace: "made", provider }
    }
    if (entry.parts.length > 0) {
      return { trace: partsTrace(entry), provider }
    }
    const trace =
      payment?.provider_id === PAYTR_PAYMENT_PROVIDER_ID
        ? await paytrTrace(container, payment.data, entry)
        : "none"
    return { trace, provider }
  } catch (error) {
    logger.warn({
      event: "orders.refund_trace_failed",
      reference: entry.reference,
      err: errorSummary(error),
    })
    return { trace: "unknown", provider }
  }
}

// `pp_paytr_paytr` → `paytr`: the alert's provider name
const providerNameOf = (providerId: string | null | undefined): string =>
  providerId?.split("_")[1] ?? "unknown"
