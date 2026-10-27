import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { toMedusaAmount } from "../../../../../lib/money"
import type { Kurus } from "../../../../../lib/money"
import { orderPaymentDetails } from "../../../../../workflows/payments/payment-details"

const lira = (amount: number | null) => (amount === null ? null : toMedusaAmount(amount as Kurus))

/**
 * `GET /admin/orders/:id/payment-details` (F5 V7): the order's PayTR
 * payments as PayTR holds them (reference, test mode, installments, card
 * brand and last four digits, PayTR's refunds) and the shop's refunds,
 * amounts as exact lira. Asked of PayTR when the shop looks.
 */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  const { payments, refunds } = await orderPaymentDetails(req.scope, req.params["id"] ?? "")
  res.json({
    payments: payments.map((payment) => ({
      ...payment,
      amount: lira(payment.amount),
      total: lira(payment.total),
      refunds: payment.refunds.map((refund) => ({ ...refund, amount: lira(refund.amount) })),
    })),
    refunds: refunds.map((refund) => ({ ...refund, amount: lira(refund.amount) })),
  })
}
