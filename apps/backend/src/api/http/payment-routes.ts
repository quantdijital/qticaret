import { validateAndTransformBody } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import type { MedusaNextFunction, MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ValidationError } from "../../lib/errors"
import { HOSTED_FORM_PROVIDERS } from "../../lib/payments/checkout"
import { paidInTestMode } from "../../lib/payments/test-mode"
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

/**
 * Medusa's own fulfillment route (the advanced panel) may not ship an order
 * paid in a provider's test mode either (adr/0027); ours refuses it in
 * `planShipmentStep`.
 */
async function refuseTestPaidFulfillment(
  req: MedusaRequest,
  _res: MedusaResponse,
  next: MedusaNextFunction
) {
  if (req.method !== "POST") {
    next()
    return
  }
  try {
    const { data } = await req.scope.resolve(ContainerRegistrationKeys.QUERY).graph({
      entity: "order",
      fields: ["payment_collections.payments.data"],
      filters: { id: req.params["id"] ?? "" },
    })
    next(
      paidInTestMode(data[0]) ? new ValidationError("orders.test_payment_not_shippable") : undefined
    )
  } catch (error) {
    next(error)
  }
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
  // PayTR's notifications (adr/0026 §5): its retries stay well inside the budget
  {
    matcher: "/hooks/paytr",
    methods: ["POST" as const],
    middlewares: [rateLimit(() => RATE_LIMIT_PROFILES.webhook)],
  },
  {
    matcher: "/admin/orders/:id/fulfillments",
    middlewares: [refuseTestPaidFulfillment],
  },
]
