import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"
import { CONVERSIONS_MODULE } from "../../../../../modules/conversions"
import type ConversionsModuleService from "../../../../../modules/conversions/service"
import type { StorePostCartTrackingType } from "./validators"

/**
 * POST /store/carts/:id/tracking (F10.9, adr/0038 §4): what the shopper
 * allowed in the cookie banner, kept against the cart until it becomes an
 * order. The browser's IP address and user agent are taken from the
 * request, and only with marketing consent. Sent again, the last answer
 * counts.
 */
export async function POST(
  req: MedusaRequest<StorePostCartTrackingType>,
  res: MedusaResponse
): Promise<void> {
  const cartId = req.params["id"] ?? ""
  const { data } = await req.scope.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "cart",
    fields: ["id", "completed_at"],
    filters: { id: cartId },
  })
  const cart = data[0] as { completed_at: unknown } | undefined
  if (!cart || cart.completed_at) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "carts.unknown")
  }
  const body = req.validatedBody
  const agent = req.get("user-agent")
  await req.scope.resolve<ConversionsModuleService>(CONVERSIONS_MODULE).recordCart(cartId, {
    ...body,
    ip: req.ip ?? req.socket.remoteAddress ?? null,
    user_agent: agent ? agent.slice(0, 500) : null,
  })
  res.json({ tracking: { analytics: body.analytics, marketing: body.marketing } })
}
