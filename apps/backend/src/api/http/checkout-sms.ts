import type { MedusaNextFunction, MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { errorSummary, logger } from "../../lib/logging"
import { checkoutSmsAllowed } from "../../lib/messaging/sms/quota"
import { perIpScale } from "../../lib/security/rate-limit"
import { holdCheckoutSmsWorkflow } from "../../workflows/messaging/checkout-sms"
import { clientBucket, sharedRateLimitStore } from "./rate-limit"

/**
 * SMS pumping through checkout (F10 M9, docs/04): "order received" goes
 * to whatever phone a shopper types, so the carts a visitor's address
 * completes are counted, and past the hour's limit their orders send no
 * text. The address itself is never stored; the cart only carries a mark.
 * A failure here lets the checkout through.
 */
export async function holdFloodingCheckoutSms(
  req: MedusaRequest,
  _res: MedusaResponse,
  next: MedusaNextFunction
) {
  if (req.method !== "POST") {
    next()
    return
  }
  try {
    const allowed = await checkoutSmsAllowed(
      sharedRateLimitStore(),
      clientBucket(req),
      perIpScale()
    )
    if (!allowed) {
      await holdCheckoutSmsWorkflow(req.scope).run({ input: { cart_id: req.params["id"] ?? "" } })
      logger.warn({ event: "messaging.checkout_sms_held" })
    }
  } catch (error) {
    logger.error({ event: "messaging.checkout_sms_hold_failed", err: errorSummary(error) })
  }
  next()
}
