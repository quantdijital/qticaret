import type { MedusaContainer } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import { errorSummary, logger } from "../../lib/logging"
import { PAYTR_PAYMENT_PROVIDER_ID } from "../../lib/payments/checkout"
import { refundRecorded } from "../../lib/payments/pending-refund"
import { paytrApi, paytrCredentialsOf } from "../../lib/payments/paytr"
import { INTEGRATION_CREDENTIALS_MODULE } from "../../modules/integration-credentials"
import type IntegrationCredentialsModuleService from "../../modules/integration-credentials/service"

/**
 * What became of an order refund's money, its ledger entry not closed:
 * - `made`: the payment's data records it (`refundRecorded`): the provider
 *   gave it back and Medusa recorded its refund; only the ledger lags.
 * - `sent`: the money left, or may have (PayTR shows a refund under the
 *   reference, a part was sent, or the payment or PayTR could not be
 *   read): never sent again under another reference, the shop checks it.
 * - `none`: surely not sent.
 */
export type RefundTrace = "made" | "sent" | "none"

export interface TracedRefund {
  reference: string
  payment_id: string
  /** Parts a provider refunding in parts sent (iyzico, `provider_parts`). */
  parts: number
}

const paytrShows = async (
  container: Pick<MedusaContainer, "resolve">,
  data: Record<string, unknown> | null | undefined,
  reference: string
): Promise<boolean> => {
  const account = paytrCredentialsOf(
    await container
      .resolve<IntegrationCredentialsModuleService>(INTEGRATION_CREDENTIALS_MODULE)
      .read("paytr")
  )
  const merchantOid = data?.["merchant_oid"]
  // Read right after the failure: without either the provider refused before sending (not_configured,
  // session_invalid)
  if (!account || typeof merchantOid !== "string") {
    return false
  }
  const paid = await paytrApi().queryStatus(account, merchantOid)
  // As our PayTR provider sends it: letters and digits, at most 64
  const sentAs = reference.replace(/[^A-Za-z0-9]/g, "").slice(0, 64)
  return paid?.refunds.some((refund) => refund.referenceNo === sentAs) ?? false
}

/** Whether the payment's data records the refund: read for a retry under the same reference. */
export async function refundMade(
  container: Pick<MedusaContainer, "resolve">,
  entry: Pick<TracedRefund, "reference" | "payment_id">
): Promise<boolean> {
  const [payment] = await container
    .resolve(Modules.PAYMENT)
    .listPayments({ id: entry.payment_id }, { select: ["id", "data"] })
  return refundRecorded(payment?.data, entry.reference)
}

/**
 * The refund's trace, read when its ledger entry would be closed as failed
 * (a step after the provider's failed, review 2026-11-17). Fails closed:
 * what cannot be read is `sent`.
 */
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
    if (refundRecorded(payment?.data, entry.reference)) {
      return { trace: "made", provider }
    }
    if (entry.parts > 0) {
      return { trace: "sent", provider }
    }
    const shown =
      payment?.provider_id === PAYTR_PAYMENT_PROVIDER_ID &&
      (await paytrShows(container, payment.data, entry.reference))
    return { trace: shown ? "sent" : "none", provider }
  } catch (error) {
    logger.warn({
      event: "orders.refund_trace_failed",
      reference: entry.reference,
      err: errorSummary(error),
    })
    return { trace: "sent", provider }
  }
}

// `pp_paytr_paytr` → `paytr`: the alert's provider name
const providerNameOf = (providerId: string | null | undefined): string =>
  providerId?.split("_")[1] ?? "unknown"
