import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { assertDevelopment } from "../../../http/dev-routes"
import type { DevGetCheckoutOrderType } from "./validators"

interface CartFacts {
  completed_at: string | null
  order?: { id: string; display_id: number; status: string } | null
  payment_collection?: {
    status: string
    payment_sessions?: { provider_id: string; status: string }[]
  } | null
}

/**
 * GET /dev/checkout/order (adr/0028): what became of a cart, for the test
 * page's return step. The Store API shows a guest no order; this does,
 * in development only.
 */
export const GET = async (
  req: MedusaRequest<unknown, DevGetCheckoutOrderType>,
  res: MedusaResponse
) => {
  assertDevelopment()
  const { data } = await req.scope.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "cart",
    fields: [
      "completed_at",
      "order.id",
      "order.display_id",
      "order.status",
      "payment_collection.status",
      "payment_collection.payment_sessions.provider_id",
      "payment_collection.payment_sessions.status",
    ],
    filters: { id: req.validatedQuery.cart_id },
  })
  const cart = data[0] as CartFacts | undefined
  res.json({
    cart: cart
      ? {
          completed_at: cart.completed_at,
          order: cart.order ?? null,
          payment_status: cart.payment_collection?.status ?? null,
          sessions: cart.payment_collection?.payment_sessions ?? [],
        }
      : null,
  })
}
