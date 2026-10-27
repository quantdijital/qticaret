import { validateAndTransformBody, validateAndTransformQuery } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import type { MedusaNextFunction, MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ValidationError } from "../../lib/errors"
import { PAYMENT_FACT_FIELDS, paidWithoutHostedForm } from "../../lib/payments/consistency"
import type { PaymentFacts } from "../../lib/payments/consistency"
import { SHIPPING_PAYMENT_FIELDS, shippingBlock } from "../../lib/payments/shippable"
import { RATE_LIMIT_PROFILES } from "../../lib/security/rate-limit"
import { StorePostCartPaymentSession } from "../store/carts/[id]/payment-session/validators"
import { StoreGetInstallments } from "../store/payment/installments/validators"
import { rateLimit } from "./rate-limit"

/**
 * Medusa's own session route is closed to shoppers (security review,
 * 2026-10-27): it would hand the shopper's `data` to a hosted form, and
 * with the system provider it opens an unpaid order the panel counts as
 * paid. Payments start from our route; bank transfer and cash on delivery
 * open their own way in F6. No `methods` on purpose: a method-scoped
 * middleware may sort after the core route.
 */
function refuseCoreSessions(req: MedusaRequest, _res: MedusaResponse, next: MedusaNextFunction) {
  next(req.method === "POST" ? new ValidationError("payments.use_checkout_route") : undefined)
}

/** A storefront completes a cart to be paid only through a hosted form's session. */
async function requireHostedPayment(
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
      entity: "cart",
      fields: PAYMENT_FACT_FIELDS,
      filters: { id: req.params["id"] ?? "" },
    })
    next(
      paidWithoutHostedForm((data[0] ?? {}) as PaymentFacts)
        ? new ValidationError("payments.use_checkout_route")
        : undefined
    )
  } catch (error) {
    next(error)
  }
}

const orderIdOf = (body: unknown): string => {
  const id = (body as { order_id?: unknown } | undefined)?.order_id
  return typeof id === "string" ? id : ""
}

/**
 * Medusa's own fulfillment route (the advanced panel) may not ship an order
 * paid in a provider's test mode, nor one whose payment is still awaited
 * (adr/0027, adr/0029); ours refuses them in `planShipmentStep`.
 */
async function refuseUnshippable(
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
      fields: SHIPPING_PAYMENT_FIELDS,
      // `/admin/orders/:id/fulfillments`, or the standalone route's `order_id`
      filters: { id: req.params["id"] ?? orderIdOf(req.body) },
    })
    const blocked = shippingBlock(data[0])
    next(blocked ? new ValidationError(blocked) : undefined)
  } catch (error) {
    next(error)
  }
}

// Starting and completing call the provider: a budget per address and per cart
const checkoutLimit = rateLimit(() => RATE_LIMIT_PROFILES.checkout, {
  identity: (req) => req.params["id"],
})

export const PAYMENT_ROUTES = [
  {
    matcher: "/store/carts/:id/payment-session",
    methods: ["POST" as const],
    middlewares: [checkoutLimit, validateAndTransformBody(StorePostCartPaymentSession)],
  },
  // F5 V6: a product page's or a cart's installment table
  {
    matcher: "/store/payment/installments",
    methods: ["GET" as const],
    middlewares: [
      rateLimit(() => RATE_LIMIT_PROFILES.installment),
      validateAndTransformQuery(StoreGetInstallments, {}),
    ],
  },
  {
    matcher: "/store/payment-collections/:id/payment-sessions",
    middlewares: [refuseCoreSessions],
  },
  {
    matcher: "/store/carts/:id/complete",
    middlewares: [checkoutLimit, requireHostedPayment],
  },
  // PayTR's notifications (adr/0026 §5): its retries stay well inside the budget
  {
    matcher: "/hooks/paytr",
    methods: ["POST" as const],
    middlewares: [rateLimit(() => RATE_LIMIT_PROFILES.webhook)],
  },
  // iyzico's callback: the shopper's browser, once per payment; per session too
  {
    matcher: "/hooks/iyzico/callback",
    methods: ["POST" as const],
    middlewares: [
      rateLimit(() => RATE_LIMIT_PROFILES.payment_return, {
        identity: (req) =>
          typeof req.query["session"] === "string" ? req.query["session"] : undefined,
      }),
    ],
  },
  {
    matcher: "/admin/orders/:id/fulfillments",
    middlewares: [refuseUnshippable],
  },
  {
    matcher: "/admin/fulfillments",
    middlewares: [refuseUnshippable],
  },
]
