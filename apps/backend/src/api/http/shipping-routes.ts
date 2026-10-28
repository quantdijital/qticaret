import type { MedusaNextFunction, MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ValidationError } from "../../lib/errors"
import { RATE_LIMIT_PROFILES } from "../../lib/security/rate-limit"
import { requireUserActor } from "./actor"
import { rateLimit } from "./rate-limit"

/**
 * `additional_data` under `qt_` is our workflows' own (the `qt_ship` mark
 * a carrier provider opens a shipment on, adr/0031): Medusa's own
 * fulfillment routes pass a caller's `additional_data` straight through,
 * so a caller may not send it.
 */
function refuseReservedAdditionalData(
  req: MedusaRequest,
  _res: MedusaResponse,
  next: MedusaNextFunction
) {
  const extra = (req.body as { additional_data?: unknown } | undefined)?.additional_data
  const reserved =
    req.method === "POST" &&
    extra !== null &&
    typeof extra === "object" &&
    Object.keys(extra).some((key) => key.startsWith("qt_"))
  next(reserved ? new ValidationError("shipping.additional_data_reserved") : undefined)
}

/**
 * F7 (adr/0031): our mark refused on Medusa's fulfillment routes; a
 * parcel's label, staff only (integration keys cannot fetch it);
 * Geliver's notifications, within the webhook budget.
 */
export const SHIPPING_ROUTES = [
  // No `methods` on purpose: a method-scoped middleware may sort after the core route
  { matcher: "/admin/orders/:id/fulfillments", middlewares: [refuseReservedAdditionalData] },
  { matcher: "/admin/fulfillments", middlewares: [refuseReservedAdditionalData] },
  {
    matcher: "/hooks/geliver",
    methods: ["POST" as const],
    middlewares: [rateLimit(() => RATE_LIMIT_PROFILES.webhook)],
  },
  {
    matcher: "/admin/orders/:id/fulfillments/:fulfillment_id/label",
    methods: ["GET" as const],
    middlewares: [requireUserActor],
  },
]
