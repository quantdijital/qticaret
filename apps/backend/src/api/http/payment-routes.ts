import { validateAndTransformBody, validateAndTransformQuery } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import type { MedusaNextFunction, MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ValidationError } from "../../lib/errors"
import { PAYMENT_FACT_FIELDS, paidOutsideCheckout } from "../../lib/payments/consistency"
import type { PaymentFacts } from "../../lib/payments/consistency"
import { SHIPPING_PAYMENT_FIELDS, shippingBlock } from "../../lib/payments/shippable"
import { RATE_LIMIT_PROFILES } from "../../lib/security/rate-limit"
import { StorePostCartPaymentSession } from "../store/carts/[id]/payment-session/validators"
import { StoreGetInstallments } from "../store/payment/installments/validators"
import { StoreGetPaymentMethods } from "../store/payment/methods/validators"
import { isFeeLine } from "../../lib/payments/cod"
import type { FeeCart } from "../../lib/payments/cod"
import { guardCheckout, guardPaymentStart } from "./checkout-guard"
import { holdFloodingCheckoutSms } from "./checkout-sms"
import { requireMailDomain } from "./mail-domain"
import { rateLimit } from "./rate-limit"

const FEE_LINE_FIELDS = ["items.id", "items.metadata", "items.variant_id", "items.is_custom_price"]
// Metadata keys the server alone writes (the fee line's `qt_fee`, the cart's `qt_sms_held`)
const RESERVED_METADATA_PREFIX = "qt_"

/**
 * Medusa's own session route is closed to shoppers (security review,
 * 2026-10-27): it would hand the shopper's `data` to a hosted form, and
 * with the system provider it opens an unpaid order the panel counts as
 * paid. Payments start from our route, every way to pay (adr/0029 too).
 * No `methods` on purpose: a method-scoped middleware may sort after the
 * core route.
 */
function refuseCoreSessions(req: MedusaRequest, _res: MedusaResponse, next: MedusaNextFunction) {
  next(req.method === "POST" ? new ValidationError("payments.use_checkout_route") : undefined)
}

/** A storefront completes a cart to be paid only through a session our route started. */
async function requireCheckoutPayment(
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
      paidOutsideCheckout((data[0] ?? {}) as PaymentFacts)
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

/** A storefront may not change or remove cash on delivery's fee line (adr/0029 §5). */
async function protectFeeLine(req: MedusaRequest, _res: MedusaResponse, next: MedusaNextFunction) {
  if (req.method !== "POST" && req.method !== "DELETE") {
    next()
    return
  }
  try {
    const { data } = await req.scope.resolve(ContainerRegistrationKeys.QUERY).graph({
      entity: "cart",
      fields: FEE_LINE_FIELDS,
      filters: { id: req.params["id"] ?? "" },
    })
    const line = ((data[0] as FeeCart | undefined)?.items ?? []).find(
      (item) => item?.id === req.params["line_id"]
    )
    next(isFeeLine(line) ? new ValidationError("cash_on_delivery.fee_line_locked") : undefined)
  } catch (error) {
    next(error)
  }
}

const reservedKeys = (metadata: unknown): boolean =>
  metadata !== null &&
  typeof metadata === "object" &&
  Object.keys(metadata).some((key) => key.startsWith(RESERVED_METADATA_PREFIX))

/**
 * Metadata under `qt_` is the server's (the fee line's marker, a cart's
 * held texts): a storefront creating or changing a cart or its lines may
 * not set it.
 */
function refuseReservedMetadata(
  req: MedusaRequest,
  _res: MedusaResponse,
  next: MedusaNextFunction
) {
  const body = req.body as { metadata?: unknown; items?: unknown } | undefined
  const items = Array.isArray(body?.items) ? (body.items as ({ metadata?: unknown } | null)[]) : []
  const reserved =
    req.method === "POST" &&
    (reservedKeys(body?.metadata) || items.some((item) => reservedKeys(item?.metadata)))
  next(reserved ? new ValidationError("cart.metadata_reserved", { field: "metadata" }) : undefined)
}

// Starting and completing call the provider: a budget per address and per cart
const checkoutLimit = rateLimit(() => RATE_LIMIT_PROFILES.checkout, {
  identity: (req) => req.params["id"],
})

export const PAYMENT_ROUTES = [
  {
    matcher: "/store/carts/:id/payment-session",
    methods: ["POST" as const],
    // F15.6 (adr/0044): every way to pay starts here, a hosted card form too:
    // the block list and checkout velocity are counted on starting
    middlewares: [
      checkoutLimit,
      validateAndTransformBody(StorePostCartPaymentSession),
      guardPaymentStart,
    ],
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
    matcher: "/store/carts/:id/line-items/:line_id",
    middlewares: [refuseReservedMetadata, protectFeeLine],
  },
  {
    matcher: "/store/carts/:id/line-items",
    middlewares: [refuseReservedMetadata],
  },
  // F10 M9: a guest's e-mail must have a domain that takes mail
  {
    matcher: "/store/carts",
    middlewares: [refuseReservedMetadata, requireMailDomain()],
  },
  {
    matcher: "/store/carts/:id",
    middlewares: [refuseReservedMetadata, requireMailDomain()],
  },
  // F6 W3: which ways to pay a cart can take (cash on delivery by its cart)
  {
    matcher: "/store/payment/methods",
    methods: ["GET" as const],
    middlewares: [
      rateLimit(() => RATE_LIMIT_PROFILES.payment_methods),
      validateAndTransformQuery(StoreGetPaymentMethods, {}),
    ],
  },
  {
    matcher: "/store/payment-collections/:id/payment-sessions",
    middlewares: [refuseCoreSessions],
  },
  {
    matcher: "/store/carts/:id/complete",
    // F15.6 (adr/0044): the block list once more before the order is made
    middlewares: [checkoutLimit, requireCheckoutPayment, guardCheckout, holdFloodingCheckoutSms],
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
