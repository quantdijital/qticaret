import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { returnableLines } from "../../../../../workflows/returns/returnable-lines"
import type { ReturnableLines } from "../../../../../workflows/returns/returnable-lines"
import { orderAccessOf } from "../../../../http/order-access"

/**
 * What the shopper sees, field by field, so nothing added to the staff
 * view later follows it here: titles, units left, why a line is outside
 * the right of withdrawal, whether it is a gift card line, the variants
 * to exchange for. Nothing personal, no staff notes.
 */
const view = (found: ReturnableLines) => ({
  window_open: found.window_open,
  open_request: found.open_request,
  lines: found.lines.map((line) => ({
    line_item_id: line.line_item_id,
    title: line.title,
    variant_title: line.variant_title,
    variant_id: line.variant_id,
    returnable: line.returnable,
    withdrawal_excluded: line.withdrawal_excluded,
    withdrawal_excluded_reason: line.withdrawal_excluded_reason,
    gift_card: line.gift_card,
    variants: line.variants.map((variant) => ({ id: variant.id, title: variant.title })),
  })),
})

/**
 * GET /store/orders/:id/returnable (F18, adr/0025 2026-11-03): what the
 * order page may ask back before the shopper sends the form, by the rules
 * the request meets (`returnableLines`, the staff view's): units left per
 * line, `withdrawal_excluded` and its reason (`product`, `personal_addon`,
 * `gift_card_used`), `gift_card`, whether the window is open. The
 * shopper's own order, signed in or with its key (`orderAccess`).
 */
export async function GET(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  res.setHeader("Cache-Control", "no-store")
  res.json(view(await returnableLines(req.scope, orderAccessOf(req).order_id)))
}
