import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { orderVouchers } from "../../../../../workflows/booking/voucher"
import { orderAccessOf } from "../../../../http/order-access"

/**
 * GET /store/orders/:id/voucher (adr/0076 Ek D7b): the order's booking
 * vouchers for its own shopper (signed in, or with the order's key; anyone
 * else is told there is no such order): the order's number, departures,
 * places and the check code. No personal data. An order without a booking:
 * `booking.voucher_unknown` (404).
 */
export async function GET(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const access = orderAccessOf(req)
  const vouchers = await orderVouchers(req.scope, access.order_id)
  if (vouchers.length === 0) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "booking.voucher_unknown")
  }
  // The code is the booking's proof: no cache on the way keeps it
  res.setHeader("Cache-Control", "no-store")
  res.json({ vouchers })
}
