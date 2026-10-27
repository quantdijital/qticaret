import type { MedusaResponse, MedusaStoreRequest } from "@medusajs/framework/http"
import { ValidationError } from "../../../../../lib/errors"
import { parseEnv } from "../../../../../lib/env"
import { returnUrlProblem } from "../../../../../lib/payments/checkout"
import { startCartPaymentWorkflow } from "../../../../../workflows/payments/start-cart-payment"
import type { StorePostCartPaymentSessionType } from "./validators"

/**
 * Starts a hosted-form payment for the cart (adr/0026 §1): the provider's
 * form token comes back; the buyer, the basket and the amount come from the
 * stored cart, never from the request.
 */
export const POST = async (
  req: MedusaStoreRequest<StorePostCartPaymentSessionType>,
  res: MedusaResponse
) => {
  const { provider_id, return_urls } = req.validatedBody
  const origins = parseEnv()
    .STORE_CORS.split(",")
    .map((origin) => origin.trim())
  const refused = returnUrlProblem(return_urls, origins)
  if (refused) {
    throw new ValidationError("payments.return_url_invalid", { field: refused })
  }
  const { result } = await startCartPaymentWorkflow(req.scope).run({
    input: {
      cart_id: req.params["id"] ?? "",
      provider_id,
      sales_channel_ids: req.publishable_key_context.sales_channel_ids,
      ip: req.ip ?? req.socket.remoteAddress ?? "",
      return_urls,
    },
  })
  res.json({
    payment_session: {
      id: result.id,
      provider_id: result.provider_id,
      status: result.status,
      data: result.data,
    },
  })
}
