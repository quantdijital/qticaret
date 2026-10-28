import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"
import { orderAccessKey, orderAccessToken } from "../../../../../lib/orders"

/** How long after checkout the cart still hands out its order's key. */
const FRESH_MS = 24 * 60 * 60 * 1000

/**
 * POST /store/carts/:id/order-access (adr/0037 §2): the order a cart
 * became, with its key, for the storefront's confirmation page. The cart
 * id is the guest's own credential, and only for a day after checkout;
 * later the key comes with the order's e-mail.
 */
export async function POST(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const { data } = await req.scope.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "cart",
    fields: ["id", "completed_at", "order.id", "order.email"],
    filters: { id: req.params["id"] ?? "" },
  })
  const cart = data[0] as
    | { completed_at: string | Date | null; order?: { id: string; email: string | null } | null }
    | undefined
  const completedAt = cart?.completed_at ? new Date(cart.completed_at).getTime() : 0
  const order = cart?.order
  if (!order?.email || Date.now() - completedAt > FRESH_MS) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "orders.unknown")
  }
  res.setHeader("Cache-Control", "no-store")
  res.json({
    order_id: order.id,
    token: orderAccessToken(orderAccessKey(), { id: order.id, email: order.email }),
  })
}
