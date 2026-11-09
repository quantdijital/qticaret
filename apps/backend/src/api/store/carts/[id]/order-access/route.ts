import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"
import { ConflictError } from "../../../../../lib/errors"
import { orderAccessKey, orderAccessToken } from "../../../../../lib/orders"
import { PAYMENT_RECOVERY_MODULE } from "../../../../../modules/payment-recovery"
import type PaymentRecoveryModuleService from "../../../../../modules/payment-recovery/service"

/** How long after checkout the cart still hands out its order's key. */
const FRESH_MS = 24 * 60 * 60 * 1000

/**
 * POST /store/carts/:id/order-access (adr/0037 §2): the order a cart
 * became, with its key, for the storefront's confirmation page. The cart
 * id is the guest's own credential, and only for a day after checkout;
 * later the key comes with the order's e-mail.
 *
 * Without an order, a card payment the cart could not become an order for
 * is being given back (adr/0026 §6): 409 `payments.refunding`, so the
 * waiting page says so instead of waiting. Otherwise 404 `orders.unknown`:
 * the provider's notice has not come yet.
 */
export async function POST(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const cartId = req.params["id"] ?? ""
  const { data } = await req.scope.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "cart",
    fields: ["id", "completed_at", "order.id", "order.email"],
    filters: { id: cartId },
  })
  const cart = data[0] as
    | { completed_at: string | Date | null; order?: { id: string; email: string | null } | null }
    | undefined
  const completedAt = cart?.completed_at ? new Date(cart.completed_at).getTime() : 0
  const order = cart?.order
  res.setHeader("Cache-Control", "no-store")
  if (!order?.email || Date.now() - completedAt > FRESH_MS) {
    if (cart && !order && (await isRefunding(req, cartId))) {
      throw new ConflictError("payments.refunding")
    }
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "orders.unknown")
  }
  res.json({
    order_id: order.id,
    token: orderAccessToken(orderAccessKey(), { id: order.id, email: order.email }),
  })
}

/** A payment for this cart that became no order and is given back (not one for an older session). */
async function isRefunding(req: MedusaRequest, cartId: string): Promise<boolean> {
  const [recovery] = await req.scope
    .resolve<PaymentRecoveryModuleService>(PAYMENT_RECOVERY_MODULE)
    .listPaymentRecoveries(
      { cart_id: cartId, reason: ["completion_failed", "amount_mismatch"] },
      { select: ["id"], take: 1 }
    )
  return Boolean(recovery)
}
