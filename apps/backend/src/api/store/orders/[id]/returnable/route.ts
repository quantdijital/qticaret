import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { customerCancelState } from "../../../../../workflows/orders/customer-cancel"
import { returnableLines } from "../../../../../workflows/returns/returnable-lines"
import type { ReturnableLines } from "../../../../../workflows/returns/returnable-lines"
import { orderAccessOf } from "../../../../http/order-access"

/**
 * What the shopper sees, field by field, so nothing added to the staff
 * view later follows it here: titles, units left, each line's window and
 * why it is shut, why a line is outside the right of withdrawal, whether
 * it is a gift card line, the variants to exchange for; and whether the
 * order may be cancelled. Nothing personal, no staff notes.
 */
const view = (found: ReturnableLines, cancel: Awaited<ReturnType<typeof customerCancelState>>) => ({
  window_open: found.window_open,
  open_request: found.open_request,
  cancellable: cancel.cancellable,
  cancel_refusal: cancel.refusal,
  lines: found.lines.map((line) => ({
    line_item_id: line.line_item_id,
    title: line.title,
    variant_title: line.variant_title,
    variant_id: line.variant_id,
    returnable: line.returnable,
    window_open: line.window_open,
    window_closed_reason: line.window_closed_reason,
    withdrawal_excluded: line.withdrawal_excluded,
    withdrawal_excluded_reason: line.withdrawal_excluded_reason,
    withdrawal_warning: line.withdrawal_warning,
    gift_card: line.gift_card,
    variants: line.variants.map((variant) => ({ id: variant.id, title: variant.title })),
  })),
})

/**
 * GET /store/orders/:id/returnable (F18, adr/0025 2026-11-03): what the
 * order page may ask back before the shopper sends the form, by the rules
 * the request meets (`returnableLines`, the staff view's): units left per
 * line and each line's own window (`window_open`, `window_closed_reason`:
 * `not_yet`, `expired`, `order_canceled`; a gift line's from its cards, a
 * shipped line's from its parcels), `withdrawal_excluded` and its reason
 * (`product`, `personal_addon`, `gift_card_used`), `withdrawal_warning`
 * (`sealed_goods`: returnable only with its seal unopened, MSY md.
 * 15/1-ç), `gift_card`, the variants an exchange may go for, whether a
 * request is open already; and whether the shopper may cancel the order,
 * by the cancel's own rule (`cancellable`, `cancel_refusal`:
 * `orders.cancel_after_packing`, `orders.cancel_contact_shop`,
 * `orders.gift_card_used`, `orders.canceled`, `orders.unknown` for an
 * order with no customer record). The shopper's own order,
 * signed in or with its key (`orderAccess`).
 */
export async function GET(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  res.setHeader("Cache-Control", "no-store")
  const orderId = orderAccessOf(req).order_id
  const [found, cancel] = await Promise.all([
    returnableLines(req.scope, orderId),
    customerCancelState(req.scope, orderId),
  ])
  res.json(view(found, cancel))
}
