import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { toMedusaAmount } from "../../../../../lib/money"
import type { Kurus } from "../../../../../lib/money"
import { orderPaymentDetails } from "../../../../../workflows/payments/payment-details"

const lira = (amount: number | null) => (amount === null ? null : toMedusaAmount(amount as Kurus))

/**
 * `GET /admin/orders/:id/payment-details` (F5 V7, V10): the order's
 * hosted-form payments as their provider holds them (reference, test mode,
 * installments, card brand and last four digits, refunds; iyzico's fraud
 * check) and the shop's refunds, amounts as exact lira. Asked of the
 * provider when the shop looks.
 */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  const { payments, refunds, bank_transfer } = await orderPaymentDetails(
    req.scope,
    req.params["id"] ?? ""
  )
  res.json({
    bank_transfer,
    payments: payments.map((payment) => ({
      ...payment,
      amount: lira(payment.amount),
      total: lira(payment.total),
      refunds: payment.refunds.map((refund) => ({ ...refund, amount: lira(refund.amount) })),
    })),
    refunds: refunds.map((refund) => ({ ...refund, amount: lira(refund.amount) })),
  })
}
