import type { MedusaNextFunction, MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { validateAndTransformBody } from "@medusajs/framework/http"
import { ValidationError } from "../../lib/errors"
import { RATE_LIMIT_PROFILES } from "../../lib/security/rate-limit"
import {
  AdminPostShippingOption,
  AdminPostShippingOptionUpdate,
} from "../admin/shipping-setup/options/validators"
import { AdminPostPttBarcodeRange } from "../admin/shipping-setup/ptt-barcodes/validators"
import { requireUserActor } from "./actor"
import { optionalCustomer, orderAccess, orderActor } from "./order-access"
import { rateLimit } from "./rate-limit"
import { hideSuspendedCarrierOptions } from "./suspended-carriers"

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
 * parcel's label, staff only (integration keys cannot fetch it).
 */
export const SHIPPING_ROUTES = [
  // No `methods` on purpose: a method-scoped middleware may sort after the core route
  { matcher: "/admin/orders/:id/fulfillments", middlewares: [refuseReservedAdditionalData] },
  { matcher: "/admin/fulfillments", middlewares: [refuseReservedAdditionalData] },
  // F7.13: a shopper cancels their own order before it is packed, signed in
  // or with the order's key from its e-mail (adr/0037 §2)
  {
    matcher: "/store/orders/:id/cancel",
    methods: ["POST" as const],
    middlewares: [
      optionalCustomer,
      orderAccess,
      rateLimit(() => RATE_LIMIT_PROFILES.order_cancel, { identity: orderActor }),
    ],
  },
  // The cart's shipping before an address: reads only, its own budget per shopper
  {
    matcher: "/store/carts/:id/shipping-estimate",
    methods: ["GET" as const],
    middlewares: [rateLimit(() => RATE_LIMIT_PROFILES.shipping_estimate)],
  },
  // A suspended carrier's options are not offered at checkout. No `methods`: the
  // middleware wraps GET answers only
  { matcher: "/store/shipping-options", middlewares: [hideSuspendedCarrierOptions] },
  // The carriers this server offers (a suspended one left out), staff only
  {
    matcher: "/admin/shipping-setup/carriers",
    methods: ["GET" as const],
    middlewares: [requireUserActor],
  },
  // F7.8: the shop's shipping options, staff only
  {
    matcher: "/admin/shipping-setup/options",
    methods: ["GET" as const],
    middlewares: [requireUserActor],
  },
  {
    matcher: "/admin/shipping-setup/options",
    methods: ["POST" as const],
    middlewares: [requireUserActor, validateAndTransformBody(AdminPostShippingOption)],
  },
  {
    matcher: "/admin/shipping-setup/options/:id",
    methods: ["POST" as const],
    middlewares: [requireUserActor, validateAndTransformBody(AdminPostShippingOptionUpdate)],
  },
  {
    matcher: "/admin/shipping-setup/options/:id",
    methods: ["DELETE" as const],
    middlewares: [requireUserActor],
  },
  // adr/0087 §4: products per shipping class, staff only
  {
    matcher: "/admin/shipping-setup/classes",
    methods: ["GET" as const],
    middlewares: [requireUserActor],
  },
  // PTT's barcode ranges (docs/entegrasyonlar/ptt.md): the shop's settings, staff only
  {
    matcher: "/admin/shipping-setup/ptt-barcodes",
    methods: ["GET" as const],
    middlewares: [requireUserActor],
  },
  {
    matcher: "/admin/shipping-setup/ptt-barcodes",
    methods: ["POST" as const],
    middlewares: [requireUserActor, validateAndTransformBody(AdminPostPttBarcodeRange)],
  },
  {
    matcher: "/admin/shipping-setup/ptt-barcodes/:id",
    methods: ["DELETE" as const],
    middlewares: [requireUserActor],
  },
  {
    matcher: "/admin/orders/:id/fulfillments/:fulfillment_id/label",
    methods: ["GET" as const],
    middlewares: [requireUserActor],
  },
]
