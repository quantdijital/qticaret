import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { orderShipments } from "../../../../../workflows/shipping/order-shipments"
import { orderAccessOf } from "../../../../http/order-access"

/**
 * GET /store/orders/:id/shipments (F18): the order's parcels that left,
 * with their carrier, tracking number and link and the carrier's last
 * status; the shopper's own order, signed in or with its key (`orderAccess`).
 */
export async function GET(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  res.setHeader("Cache-Control", "no-store")
  res.json({ shipments: await orderShipments(req.scope, orderAccessOf(req).order_id) })
}
