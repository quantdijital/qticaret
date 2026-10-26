import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { toMedusaAmount } from "../../../../../lib/money"
import type { MoneyTotals } from "../../../../../workflows/orders/order-money"
import { readOrderMoney } from "../../../../../workflows/orders/order-money"

const amounts = (totals: MoneyTotals) => ({
  gross: toMedusaAmount(totals.gross),
  discount: toMedusaAmount(totals.discount),
  net: toMedusaAmount(totals.net),
})

/**
 * `GET /admin/orders/:id/money` (F4.7): each line's price, discount share
 * and payment as exact lira ("20.50"), the items' and shipping's totals,
 * the units given back, and what a refund can still return. No personal
 * data.
 */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  const money = await readOrderMoney(req.scope, req.params["id"] ?? "")
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
      })),
      ...amounts(money),
      items: amounts(money.items),
      shipping: amounts(money.shipping),
      paid: toMedusaAmount(money.paid),
      refunded: toMedusaAmount(money.refunded),
      refundable: toMedusaAmount(money.refundable),
    },
  })
}
