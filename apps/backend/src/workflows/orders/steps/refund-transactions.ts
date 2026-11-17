import type { BigNumberInput, MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, MathBN, Modules } from "@medusajs/framework/utils"
import { StepResponse, createStep } from "@medusajs/framework/workflows-sdk"
import { logger } from "../../../lib/logging"
import { refundRecordOf } from "../../../lib/payments/pending-refund"

interface PaymentRefunds {
  currency_code: string
  data?: Record<string, unknown> | null
  refunds?: ({ id: string; amount?: BigNumberInput; raw_amount?: BigNumberInput } | null)[] | null
}

export interface RefundOfEntry {
  order_id: string
  payment_id: string
  reference: string
  /** Kuruş. */
  amount: number
}

/**
 * The order money move of one ledger refund's own Medusa refund, written
 * when missing (review D1, D-3). The payment's data names that refund
 * (`refund_id`, the key Medusa gave the provider call); its move is looked
 * for by its id alone, whatever its reference: Medusa writes its cancel's
 * refunds under the payment's id (2.21.2 `refundPaymentsWorkflow`), its
 * own refunds under the refund's (`refundPaymentWorkflow`, reference
 * `refund`), and no other refund is touched. A record from before Medusa's
 * refund was named is left as it is.
 */
export async function restoreRefundTransaction(
  container: Pick<MedusaContainer, "resolve">,
  entry: RefundOfEntry
): Promise<number> {
  const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "payment",
    fields: ["currency_code", "data", "refunds.id", "refunds.amount", "refunds.raw_amount"],
    filters: { id: entry.payment_id },
  })
  const payment = data[0] as PaymentRefunds | undefined
  const refundId = refundRecordOf(payment?.data, entry.reference, entry.amount)?.refund_id
  const refund = (payment?.refunds ?? []).find((each) => each?.id === refundId)
  if (!payment || !refund) {
    logger.warn({ event: "orders.refund_move_unknown", reference: entry.reference })
    return 0
  }
  const orders = container.resolve(Modules.ORDER)
  const [there] = await orders.listOrderTransactions(
    { order_id: entry.order_id, reference_id: refund.id },
    { select: ["id"], take: 1 }
  )
  if (there) {
    return 0
  }
  await orders.addOrderTransactions({
    order_id: entry.order_id,
    amount: MathBN.mult(refund.raw_amount ?? refund.amount ?? 0, -1),
    currency_code: payment.currency_code,
    reference: "refund",
    reference_id: refund.id,
  })
  return 1
}

/** `restoreRefundTransaction` as a step of the refund workflow's `made` path. */
export const restoreRefundTransactionsStep = createStep(
  "orders-restore-refund-transactions",
  async (input: RefundOfEntry, { container }) =>
    new StepResponse(await restoreRefundTransaction(container, input))
)
