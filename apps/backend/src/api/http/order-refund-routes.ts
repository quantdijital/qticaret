import { validateAndTransformBody } from "@medusajs/framework/http"
import type {
  AuthenticatedMedusaRequest,
  MedusaNextFunction,
  MedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { ValidationError } from "../../lib/errors"
import { HOSTED_FORM_PROVIDERS } from "../../lib/payments/checkout"
import { RATE_LIMIT_PROFILES } from "../../lib/security/rate-limit"
import { readOrderMoney } from "../../workflows/orders/order-money"
import { refundOrderWorkflow } from "../../workflows/orders/refund-order"
import {
  AdminPostOrderRefund,
  AdminPostOrderRefundPreview,
} from "../admin/orders/[id]/refunds/validators"
import { requireUserActor } from "./actor"
import { rateLimit } from "./rate-limit"

const isHosted = (provider: string | null | undefined) =>
  (HOSTED_FORM_PROVIDERS as readonly string[]).includes(provider ?? "")

/** Medusa's own payment refund: a hosted form's payment is given back line by line, through ours. */
async function refuseHostedPaymentRefund(
  req: MedusaRequest,
  _res: MedusaResponse,
  next: MedusaNextFunction
) {
  if (req.method !== "POST") {
    next()
    return
  }
  try {
    const [payment] = await req.scope
      .resolve(Modules.PAYMENT)
      .listPayments({ id: req.params["id"] ?? "" }, { select: ["provider_id"] })
    next(
      isHosted(payment?.provider_id) ? new ValidationError("payments.use_order_refund") : undefined
    )
  } catch (error) {
    next(error)
  }
}

/**
 * Medusa's cancel gives a captured payment back but goes on when the
 * refund fails, leaving the order cancelled and the money kept. An order
 * Medusa would cancel is refunded through ours first, under a reference of
 * its own (tried again, refunded once); a refund that fails stops the
 * cancel with the provider's reason.
 */
async function refundBeforeCancel(
  req: MedusaRequest,
  _res: MedusaResponse,
  next: MedusaNextFunction
) {
  if (req.method !== "POST") {
    next()
    return
  }
  const orderId = req.params["id"] ?? ""
  try {
    const { data } = await req.scope.resolve(ContainerRegistrationKeys.QUERY).graph({
      entity: "order",
      fields: ["status", "fulfillments.canceled_at"],
      filters: { id: orderId },
    })
    const order = data[0] as
      { status?: string; fulfillments?: ({ canceled_at?: unknown } | null)[] | null } | undefined
    const cancellable =
      order !== undefined &&
      order.status !== "canceled" &&
      order.status !== "completed" &&
      (order.fulfillments ?? []).every((fulfillment) => fulfillment?.canceled_at)
    // Not one Medusa would cancel: its own answer says why, and nothing is refunded
    if (!cancellable) {
      next()
      return
    }
    const { refundable } = await readOrderMoney(req.scope, orderId)
    if (refundable > 0) {
      await refundOrderWorkflow(req.scope).run({
        input: {
          order_id: orderId,
          reference: `cancel${orderId.replace(/[^A-Za-z0-9]/g, "")}`.slice(0, 40),
          request: { amount: refundable },
          note: "order canceled",
          created_by: (req as Partial<AuthenticatedMedusaRequest>).auth_context?.actor_id ?? null,
        },
      })
    }
    next()
  } catch (error) {
    next(error)
  }
}

// Each refund asks the provider: a budget per address and per staff member
const refundLimit = rateLimit(() => RATE_LIMIT_PROFILES.provider_check, {
  identity: (req) => (req as Partial<AuthenticatedMedusaRequest>).auth_context?.actor_id,
})

/** F5 V5: money back on an order, line by line, through our flow only. */
export const ORDER_REFUND_ROUTES = [
  {
    matcher: "/admin/orders/:id/refunds/preview",
    methods: ["POST" as const],
    middlewares: [requireUserActor, validateAndTransformBody(AdminPostOrderRefundPreview)],
  },
  {
    matcher: "/admin/orders/:id/refunds",
    methods: ["POST" as const],
    middlewares: [requireUserActor, refundLimit, validateAndTransformBody(AdminPostOrderRefund)],
  },
  // No `methods` on purpose: a method-scoped middleware may sort after the core route
  { matcher: "/admin/payments/:id/refund", middlewares: [refuseHostedPaymentRefund] },
  { matcher: "/admin/orders/:id/cancel", middlewares: [refundBeforeCancel] },
]
