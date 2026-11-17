import type { BigNumberInput, CreateOrderTransactionDTO } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, MathBN, Modules } from "@medusajs/framework/utils"
import { StepResponse, createStep } from "@medusajs/framework/workflows-sdk"

interface PaymentRefunds {
  currency_code: string
  refunds?: ({ id: string; amount?: BigNumberInput; raw_amount?: BigNumberInput } | null)[] | null
}

/**
 * The order's money moves for its payment's refunds, each once (review
 * D1): a refund closed as made (`RefundPlan.made`) skips Medusa's
 * `refundPaymentWorkflow`, whose `addOrderTransactionStep` may have
 * failed after the refund itself. As Medusa writes them (2.21.2: reference
 * `refund`, the refund's id, its amount negative); one there already, by
 * order, reference and id, is left as it is.
 */
export const restoreRefundTransactionsStep = createStep(
  "orders-restore-refund-transactions",
  async (input: { order_id: string; payment_id: string }, { container }) => {
    const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
      entity: "payment",
      fields: ["currency_code", "refunds.id", "refunds.amount", "refunds.raw_amount"],
      filters: { id: input.payment_id },
    })
    const payment = data[0] as PaymentRefunds | undefined
    const refunds = (payment?.refunds ?? []).filter(
      (refund): refund is NonNullable<typeof refund> => refund !== null
    )
    if (!payment || refunds.length === 0) {
      return new StepResponse(0)
    }
    const orders = container.resolve(Modules.ORDER)
    const existing = await orders.listOrderTransactions(
      { order_id: input.order_id, reference: "refund", reference_id: refunds.map(({ id }) => id) },
      { select: ["reference_id"] }
    )
    const there = new Set(existing.map((transaction) => transaction.reference_id))
    const missing: CreateOrderTransactionDTO[] = refunds
      .filter((refund) => !there.has(refund.id))
      .map((refund) => ({
        order_id: input.order_id,
        amount: MathBN.mult(refund.raw_amount ?? refund.amount ?? 0, -1),
        currency_code: payment.currency_code,
        reference: "refund",
        reference_id: refund.id,
      }))
    if (missing.length > 0) {
      await orders.addOrderTransactions(missing)
    }
    return new StepResponse(missing.length)
  }
)
