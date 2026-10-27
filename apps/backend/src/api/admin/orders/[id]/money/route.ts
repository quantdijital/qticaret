import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { toMedusaAmount } from "../../../../../lib/money"
import type { MoneyTotals } from "../../../../../workflows/orders/order-money"
import { kurus } from "../../../../../lib/money"
import { ORDER_REFUNDS_MODULE } from "../../../../../modules/order-refunds"
import type OrderRefundsModuleService from "../../../../../modules/order-refunds/service"
import { readOrderMoney } from "../../../../../workflows/orders/order-money"

const amounts = (totals: MoneyTotals) => ({
  gross: toMedusaAmount(totals.gross),
  discount: toMedusaAmount(totals.discount),
  net: toMedusaAmount(totals.net),
})

/**
 * `GET /admin/orders/:id/money` (F4.7): each line's price, discount share
 * and payment as exact lira ("20.50"), the items' and shipping's totals,
 * the units given back, what gift cards and store credit paid, and what
 * a refund can still return, and what refunds gave back line by line.
 * No personal data.
 */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  const orderId = req.params["id"] ?? ""
  const money = await readOrderMoney(req.scope, orderId)
  // F5 V5: what the order's refunds gave back, line by line
  const refunded = await req.scope
    .resolve<OrderRefundsModuleService>(ORDER_REFUNDS_MODULE)
    .refundedLines(orderId)
  res.json({
    money: {
      currency_code: money.currency_code,
      lines: money.lines.map((line) => ({
        id: line.id,
        kind: line.kind,
        quantity: line.quantity,
        returned: line.returned,
        ...amounts(line),
        returned_net: toMedusaAmount(line.returned_net),
        refunded_units: refunded.units.get(line.id) ?? 0,
        refunded_net: toMedusaAmount(kurus(refunded.net.get(line.id) ?? 0)),
      })),
      ...amounts(money),
      items: amounts(money.items),
      shipping: amounts(money.shipping),
      credit: toMedusaAmount(money.credit),
      paid: toMedusaAmount(money.paid),
      refunded: toMedusaAmount(money.refunded),
      refundable: toMedusaAmount(money.refundable),
    },
  })
}
