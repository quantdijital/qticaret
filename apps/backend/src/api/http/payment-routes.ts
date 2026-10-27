import { validateAndTransformBody } from "@medusajs/framework/http"
import type { MedusaNextFunction, MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ValidationError } from "../../lib/errors"
import { HOSTED_FORM_PROVIDERS } from "../../lib/payments/checkout"
import { RATE_LIMIT_PROFILES } from "../../lib/security/rate-limit"
import { StorePostCartPaymentSession } from "../store/carts/[id]/payment-session/validators"
import { rateLimit } from "./rate-limit"

/**
 * Medusa's own session route hands the shopper's `data` to the provider:
 * a hosted form would take a basket and a buyer the shopper wrote. Ours
 * builds them from the cart (adr/0026 §1). No `methods` on purpose: a
 * method-scoped middleware may sort after the core route.
 */
function refuseHostedProviders(req: MedusaRequest, _res: MedusaResponse, next: MedusaNextFunction) {
  const provider = (req.body as { provider_id?: unknown } | undefined)?.provider_id
  if (req.method === "POST" && (HOSTED_FORM_PROVIDERS as readonly unknown[]).includes(provider)) {
    next(new ValidationError("payments.use_checkout_route", { field: "provider_id" }))
    return
  }
  next()
}

export const PAYMENT_ROUTES = [
  {
    matcher: "/store/carts/:id/payment-session",
    methods: ["POST" as const],
    middlewares: [
      // Each start calls the provider: a budget per address and per cart
      rateLimit(() => RATE_LIMIT_PROFILES.checkout, { identity: (req) => req.params["id"] }),
      validateAndTransformBody(StorePostCartPaymentSession),
    ],
  },
  {
    matcher: "/store/payment-collections/:id/payment-sessions",
    middlewares: [refuseHostedProviders],
  },
]
