import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import type { FilterableCartProps } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import { CART_REMINDERS_MODULE } from "../../../../modules/cart-reminders"
import type CartRemindersModuleService from "../../../../modules/cart-reminders/service"

const DAYS = 30
const CHUNK = 500

/**
 * GET /admin/cart-reminders/summary (F10.7): what the last 30 days'
 * reminders did, for Settings > Marketing: sent, followed back to the
 * cart, and the carts that became an order.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const since = new Date(Date.now() - DAYS * 24 * 60 * 60 * 1000)
  const {
    sent,
    returned,
    cart_ids: cartIds,
  } = await req.scope.resolve<CartRemindersModuleService>(CART_REMINDERS_MODULE).sentSince(since)
  const carts = req.scope.resolve(Modules.CART)
  let ordered = 0
  for (let start = 0; start < cartIds.length; start += CHUNK) {
    const ids = cartIds.slice(start, start + CHUNK)
    // Medusa's filter types call `completed_at` text; the database takes $ne null
    const filters = { id: ids, completed_at: { $ne: null } } as unknown as FilterableCartProps
    ordered += (await carts.listCarts(filters, { select: ["id"], take: ids.length })).length
  }
  res.json({ summary: { sent, returned, ordered } })
}
