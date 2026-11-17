import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { isWholesaleOrder } from "../../../../../workflows/wholesale/orders"
import { orderAccessOf } from "../../../../http/order-access"

/**
 * GET /store/orders/:id/wholesale (ADR-0068 slice 5 review L2): whether the
 * order is a wholesale order, for the order page's purchase event, which
 * then names no amount (a wholesaler's prices are theirs alone, §7). Asked
 * of the order, not of the session: a page opened signed out knows too.
 * Only the order's own customer or the holder of its key (`orderAccess`);
 * anyone else is told there is no such order. A yes or no, nothing of the
 * account behind it. Read as the server's purchase events read it
 * (`isWholesaleOrder`: stamped, or placed by a wholesaler and not stamped yet).
 */
export async function GET(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const wholesale = await isWholesaleOrder(req.scope, orderAccessOf(req).order_id)
  res.setHeader("Cache-Control", "private, no-store")
  res.json({ wholesale })
}
